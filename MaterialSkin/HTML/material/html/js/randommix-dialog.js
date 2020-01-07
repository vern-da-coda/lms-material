/**
 * LMS-Material
 *
 * Copyright (c) 2018-2020 Craig Drummond <craig.p.drummond@gmail.com>
 * MIT license.
 */

Vue.component('lms-randommix', {
    template: `
<v-dialog v-model="show" v-if="show" persistent scrollable width="600">
 <v-card>
  <v-card-text>
   <v-select :items="mixes" :label="i18n('Mix Type')" v-model="chosenMix" item-text="label" item-value="key"></v-select>
   <v-select chips deletable-chips multiple :items="genres" :label="i18n('Selected Genres')" v-model="chosenGenres">
    <v-list-tile slot="prepend-item" @click="toggleGenres()">
     <v-list-tile-action><v-icon>{{selectAllIcon}}</v-icon></v-list-tile-action>
     <v-list-tile-title>{{i18n('Select All')}}</v-list-tile-title>
    </v-list-tile>
    <v-divider slot="prepend-item"></v-divider>
   </v-select>
   <v-select v-if="libraries.length>1" :items="libraries" :label="i18n('Library')" v-model="library" item-text="name" item-value="id"></v-select>
  </v-card-text>
  <v-card-actions>
   <v-spacer></v-spacer>
   <v-btn flat @click.native="close()">{{i18n('Close')}}</v-btn>
   <v-btn flat @click.native="stop()" v-if="active">{{i18n('Stop')}}</v-btn>
   <v-btn flat @click.native="start()">{{i18n('Start')}}</v-btn>
  </v-card-actions>
 </v-card>
</v-dialog>
`,
    props: [],
    data() {
        return {
            show: false,
            genres: [],
            chosenGenres: [],
            mixes: [],
            chosenMix: "tracks",
            active: false,
            libraries: [],
            library: undefined
        }
    },
    computed: {
        selectAllIcon () {
            if (this.chosenGenres.length==this.genres.length) {
                return "check_box";
            }
            if (this.chosenGenres.length>0) {
                return "indeterminate_check_box";
            }
            return "check_box_outline_blank";
        }
    },
    mounted() {
        bus.$on('rndmix.open', function() {
            this.playerId = this.$store.state.player.id;
            lmsCommand(this.playerId, ["randomplayisactive"]).then(({data}) => {
                this.mixes=[{key:"tracks", label:i18n("Song Mix")},
                            {key:"albums", label:i18n("Album Mix")},
                            {key:"contributors", label:i18n("Artist Mix")},
                            {key:"year", label:i18n("Year Mix")}];
                if (data && data.result && data.result._randomplayisactive) {
                    this.chosenMix = data.result._randomplayisactive;
                    this.active = true;
                } else {
                    this.active = false;
                    this.choseMix = "tracks";
                }

                lmsList(this.playerId, ["randomplaylibrarylist"], undefined, 0, 500).then(({data}) => {
                    if (data && data.result && data.result.item_loop && data.result.item_loop.length>0) {
                        this.libraries = [];
                        this.library = undefined;
                        for (var i=0, len=data.result.item_loop.length; i<len; ++i) {
                            var id = data.result.item_loop[i].actions.do.cmd[1];
                            if ((""+id).length>2) {
                                this.libraries.push({name:data.result.item_loop[i].text.replace(SIMPLE_LIB_VIEWS, ""), id:id});
                                if (parseInt(data.result.item_loop[i].radio)==1) {
                                    this.library = id;
                                }
                            }
                        }
                        this.libraries.sort(nameSort);
                        this.libraries.unshift({name: i18n("All"), id:LMS_DEFAULT_LIBRARY});
                        if (undefined==this.library) {
                            this.library = LMS_DEFAULT_LIBRARY;
                        }
                    }
                });

                lmsList(this.playerId, ["genres"], undefined, 0, 1000).then(({data}) => {
                    this.chosenGenres = [];
                    this.genres = [];
                    // Get list of all genres (randomplaygenrelist filters on library chosen for mix!)
                    if (data && data.result && data.result.genres_loop) {
                        for (var idx=0, loop=data.result.genres_loop, loopLen=loop.length; idx<loopLen; ++idx) {
                            this.genres.push(loop[idx].genre);
                        }
                    }
                    lmsList(this.playerId, ["randomplaygenrelist"], undefined, 0, 500).then(({data}) => {
                        if (data && data.result && data.result.item_loop) {
                            data.result.item_loop.forEach(i => {
                                if (i.checkbox==1) {
                                    this.chosenGenres.push(i.text);
                                }
                            });
                            this.show=true;
                        }
                    });
                });
            });
        }.bind(this));
        bus.$on('noPlayers', function() {
            this.show=false;
        }.bind(this));
        bus.$on('esc', function() {
            if (this.$store.state.activeDialog == 'rndmix') {
                this.show=false;
            }
        }.bind(this));
    },
    methods: {
        close() {
            this.show=false;
        },
        start() {
            this.close();
            lmsCommand(this.playerId, ["randomplaychooselibrary", this.library]).then(({data}) => {
                if (this.chosenGenres.length==0) {
                    lmsCommand(this.playerId, ["randomplaygenreselectall", "0"]).then(({data}) => {
                        lmsCommand(this.playerId, ["randomplay", this.chosenMix]);
                    });
                } else if (this.chosenGenres.length==this.genres.length) {
                    lmsCommand(this.playerId, ["randomplaygenreselectall", "1"]).then(({data}) => {
                        lmsCommand(this.playerId, ["randomplay", this.chosenMix]);
                    });
                } else {
                    lmsCommand(this.playerId, ["randomplaygenreselectall", "0"]).then(({data}) => {
                        this.addGenre();
                    });
                }
            });
        },
        stop() {
            this.close();
            lmsCommand(this.playerId, ["randomplay", "disable"]);
        },
        addGenre() {
            if (0==this.chosenGenres.length) {
                lmsCommand(this.playerId, ["randomplay", this.chosenMix]);
            } else {
                lmsCommand(this.playerId, ["randomplaychoosegenre", this.chosenGenres.shift(), "1"]).then(({data}) => {
                    this.addGenre();
                });
            }
        },
        toggleGenres() {
            if (this.chosenGenres.length==this.genres.length) {
                this.chosenGenres = [];
            } else {
                this.chosenGenres = this.genres.slice();
            }
        },
        i18n(str) {
            if (this.show) {
                return i18n(str);
            } else {
                return str;
            }
        }
    },
    watch: {
        'show': function(val) {
            this.$store.commit('dialogOpen', {name:'rndmix', shown:val});
        }
    }
})

