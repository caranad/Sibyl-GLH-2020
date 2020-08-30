Vue.component('rating', {
    template: '#rating-template',
    props : ['rating']
});
Vue.component('news', {
    template: '#news-template',
    props : ['heading', 'list']
});
Vue.component('suggestions', {
    template: '#suggestions-template',
    props : ['data']
});
Vue.component('covid', {
    template: '#covid-template',
    props : ['data'],
    methods : {
        severityToRating : function(severity) {
            if (severity === "LOW") return 0.9;
            if (severity === "MODERATE") return 0.4;
            return 0.2;
        }
    }
});
Vue.component('product', {
    template: '#product-template',
    props : ['data'],
    methods : {
        stockToRating : function(stock) {
            if (stock === "In Stock.") return 1;
            return 0;
        }
    }
});
Vue.component('covidnews', {
    template: '#covidnews-template',
    props : ['data']
});
Vue.component('airlinenews', {
    template: '#airlinenews-template',
    props : ['data']
});
Vue.component('whonews', {
    template: '#whonews-template',
    props : ['data']
});
Vue.component('res-table', {
    template: '#res-table-template',
    props : ['list'],
    data : function() {
        return {
            columns : []
        };
    },
    mounted : function() {
        this.updateColumns();
        window.onresize = () => {
            this.updateColumns();
        };
    },
    watch : {
        list : function(new_v, old_v) {
            this.updateColumns();
        }
    },
    methods : {
        updateColumns : function() {
            if (document.body.clientWidth <= 600 || this.list.length <= 1) this.columns = [[]];
            else if (document.body.clientWidth <= 1300 || this.list.length <= 2) this.columns = [[], []];
            else this.columns = [[], [], []];

            for(var i=0; i<this.list.length; i+=1) {
                var col = this.columns[i % this.columns.length];
                col.push(this.list[i]);
            }
        }
    }
});

var app = new Vue({
    el: "#app", 
    data: function() {
        var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        return {
            data: {},
            noteContent : [],
            started : false,          // started process (need user interaction to start)
            listening : false,        // listening (will resume on own when not listening)
            processing : false,       // processing
            version : 0,
            list : [],
            recognition : new SpeechRecognition()
        };
    },
    mounted : function() {
        var vm = this;

        var captured;

        //this.recognition.continuous = true;
        this.recognition.onstart = function() { 
            captured = false;
            setTimeout(function(version) {
                if (version === vm.version) {
                    vm.listening = true;
                }
            }, 700, vm.version);
            console.log('Voice recognition activated. Try speaking into the microphone.'); 
        };
    
        this.recognition.onspeechend = function(event) {
            vm.listening = false;
            vm.recognition.stop();
            console.log('Your speech finished or was cut off mid way from abort.');
            setTimeout(function(version) {
                if (version === vm.version && !captured) {
                    vm.listening = true;
                    vm.recognition.start();
                }
            }, 1000, vm.version);
        };
    
        this.recognition.onerror = function(event) {
            if(event.error === 'no-speech') {
                vm.listening = false;
                vm.recognition.stop();
                setTimeout(function(version) {
                    if (version === vm.version) {
                        vm.recognition.start();
                    }
                }, 1000, vm.version);
                console.log('No speech was detected. Try again.');
            }
            else if(event.error === 'aborted') {
                console.log('User aborted. Try again.');  
            }
        };
    
        this.recognition.onresult = function(event) {

            captured = true;

            // event is a SpeechRecognitionEvent object.
            // It holds all the lines we have captured so far. 
            // We only need the current one.
            var current = event.resultIndex;
    
            // Get a transcript of what was said.
            var transcript = event.results[current][0].transcript;
    
            // Add the current transcript to the contents of our Note.
            var mobileRepeatBug = (current == 1 && transcript == event.results[0][0].transcript);
            if(!mobileRepeatBug) {
                console.log("DETECTED:", transcript);
                vm.getSuggestions(transcript);
            }
        };
    },
    methods : {
        begin : function() {
            if (this.started) { // turn off
                this.recognition.abort();
                this.data = {};
                this.noteContent = [];
                this.started = false;
                this.listening = false;
                this.processing = false;
                this.version += 1;
                this.list = [];
                this.forcePageOverflowState(false);
            } else {           // turn on
                this.data = {};
                this.noteContent = [];
                this.started = true;
                this.listening = false;
                this.processing = false;
                this.list = [];
                this.forcePageOverflowState(false);
                this.recognition.start();
            }
        },
        speak : function (text) {
            return new Promise((resolve, reject) => {
                var msg = new SpeechSynthesisUtterance(text);
                msg.onend = function(event) {
                    resolve();
                };  
                msg.onerror = function(event) {
                    reject();
                };
                window.speechSynthesis.speak(msg); 
            });
        },
        forcePageOverflowState : function(enable) {
            $("html").toggleClass('overflow-y-hidden', enable);
        },
        getSuggestions : async function(speech) {

            var vm = this;
            var before_version = vm.version;

            vm.processing = true;
            vm.noteContent.push("<b>User</b>: " + speech);
            var response = await fetch("/api/input", {
                method: 'POST', 
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    speech : speech
                })
            });
            if (before_version !== vm.version) return;

            var data = await response.json();
            if (before_version !== vm.version) return;

            vm.processing = false;
            vm.noteContent.push("<b>NB</b>: " + data.speech);
            await vm.speak(data.speech);
            if (before_version !== vm.version) return;

            if (data.label === "end") {

                vm.processing = true;
                var response = await fetch("/api/suggestions");
                if (before_version !== vm.version) return;

                var dat = await response.json();
                if (before_version !== vm.version) return;

                vm.noteContent = [];
                vm.data = dat;

                if (vm.data.suggestions.length > 0) 
                    vm.list.push({name:"suggestions", data:vm.data.suggestions});
                if (vm.data.data_points && vm.data.data_points.covid_data) 
                    vm.list.push({name:"covid", data:vm.data.data_points.covid_data});
                if (vm.data.data_points && vm.data.data_points.amazon_server_data) 
                    vm.list.push({name:"product", data:vm.data.data_points.amazon_server_data});
                if (vm.data.data_points && vm.data.data_points.news_data && vm.data.data_points.news_data.covid19news.length > 0) 
                    vm.list.push({name:"covidnews", data:vm.data.data_points.news_data.covid19news});
                if (vm.data.data_points && vm.data.data_points.news_data && vm.data.data_points.news_data.airlinenews.length > 0) 
                    vm.list.push({name:"airlinenews", data:vm.data.data_points.news_data.airlinenews});
                if (vm.data.data_points && vm.data.data_points.news_data && vm.data.data_points.news_data.whonews.length > 0) 
                    vm.list.push({name:"whonews", data:vm.data.data_points.news_data.whonews});

                await vm.$nextTick();
                if (before_version !== vm.version) return;

                vm.forcePageOverflowState(true);
                var logs = $(vm.$el).find(".logcontainer .logcolumn .log"), count = 0;
                logs.each(function(i, x) {
                    var duration = 0.4;
                    TweenMax.from(x, duration, { 
                        opacity: 0,
                        y: 50 * (i+1),
                        delay:duration*i,
                        onComplete : function() {
                            if (before_version !== vm.version) return;
        
                            count++;
                            if (count === logs.length) {
                                vm.forcePageOverflowState(false);
                            }
                        }
                    });
                });

                vm.processing = false;
                await vm.speak("Your report is ready.");
                if (before_version !== vm.version) return;

                vm.started = false;
            } else {
                setTimeout(function(before_version) {
                    if (before_version !== vm.version) return;

                    vm.listening = true;
                    vm.recognition.start();
                }, 1000, before_version);
            }
        }
    }
});