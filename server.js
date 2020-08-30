const express = require('express');
const natural = require('natural');
const fse = require('fse');
const https = require('https');
const path = require('path');
const stopword = require('stopword');
const amazon = require('./modules/amazon');
const covid = require('./modules/covid');
const edit_distance = require('./modules/edit_distance');
const news = require('./modules/newsapi');
const app = express();

var tokenizer = new natural.WordTokenizer();

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({
    extended: true
}));

//var input = stopword.removeStopwords(tokenizer.tokenize("I want to buy Lenovo servers from Amazon"));
//var output = stopword.removeStopwords(tokenizer.tokenize("want to buy Lenovo servers from amazon"));
//var input = ['new', 'york', 'city'];
//var output = ["daughter"];
//console.log(input, output);
//var ed = edit_distance.editDistance(input, output);
//console.log(ed);

// reset data points
function ResetDataPoints() {
    state = 0;
    from_region = "";
    to_region = "";
    product_info = "";
}

var state, from_region, to_region, product_info;
ResetDataPoints();

// leave this to DEBUG ////////////////////////////
//from_region = "fly houston county";
//to_region = "working new york city";
//product_info = "HP servers amazon";
//state = 7;
/////////////////////////////////////

app.post('/api/input', async (req, res) => {

    // get speech classifier
    const speech_model = JSON.parse(fse.readFileSync("./json/speech_knowledge_base.json", "utf8"));

    // convert speech phrases into speech intentions
    var user_speech = req.body.speech;
    var tokenized_phrase = tokenizer.tokenize(user_speech);
    var cleaned_tokenized_phrase = stopword.removeStopwords(tokenized_phrase);
    
    var speech_intention;

    if (cleaned_tokenized_phrase.length > 0) {
        var speech_model_results = speech_model.map(function(item) {
            var model_input_tokenized_phrase = tokenizer.tokenize(item.input);
            var cleaned_model_input_tokenized_phrase = stopword.removeStopwords(model_input_tokenized_phrase);
            var result = edit_distance.editDistance(cleaned_tokenized_phrase, cleaned_model_input_tokenized_phrase);
            result.input = user_speech;
            result.label = item.output;
            result.speech = item.speech;
            result.state = item.state;
            result.next_state = item.next_state;
            return result;
        });
        speech_model_results.sort(function(a, b) {
            return a.ed - b.ed;
        });

        var result = speech_model_results[0];

        // filter out really bad results
        //var speech_intention = null;
        //if (result.value >= 0.25) {
        //    speech_intention = result;
        //}
        speech_intention = result;
    }

    console.log("speech_intention", speech_intention);
    var unknown_speech_obj = {
        speech : "Sorry, I didn't understand. Please try again."
    };

    if (speech_intention) {

        console.log("State:", state);
        var is_following = true;

        if (speech_intention.label==="start") {
            ResetDataPoints();
            state = speech_intention.next_state;
        }
        else if (speech_intention.state===state) {
            state = speech_intention.next_state;
        } 
        else {
            is_following = false;
            speech_intention = unknown_speech_obj;
        }

        console.log("New State:", state);

        if (is_following) {
            if (speech_intention.label==="working new york city") {
                to_region = speech_intention.label;
            }
            else if (speech_intention.label==="working bennington county") {
                to_region = speech_intention.label;
            }
            else if (speech_intention.label==="fly houston county") {
                from_region = speech_intention.label;
            }
            else if (speech_intention.label==="fly missoula county") {
                from_region = speech_intention.label;
            }
            else if (speech_intention.label==="HP servers amazon") {
                product_info = speech_intention.label;
            }
            else if (speech_intention.label==="Lenovo servers amazon") {
                product_info = speech_intention.label;
            }
        }
    }

    // return result
    setTimeout(function() {
        res.json(speech_intention || unknown_speech_obj);
    }, 2 * 1000);
});

app.get('/api/suggestions', async (req, res) => {

    var stock, from_level, to_level;
    var covid_data, amazon_server_data, news_data;

    if (from_region === "fly houston county") {
        covid_data = await covid.getCoviddata("https://www.trackcorona.live/api/cities/Houston%20County,%20Alabama", "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d218516.843834125!2d-85.49601574889388!3d31.156236449814276!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x88928892ca57cbc5%3A0x1c38a8f4d8630ffa!2sHouston%20County%2C%20AL%2C%20USA!5e0!3m2!1sen!2sca!4v1588877388730!5m2!1sen!2sca");
        from_level = covid_data.severity;
        news_data = await news.getNewsData("houston county");
    }
    else if (from_region === "fly missoula county") {
        covid_data = await covid.getCoviddata("https://www.trackcorona.live/api/cities/Missoula%20County,%20Montana", "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d695080.0949451076!2d-114.61027284985424!3d47.11560198729137!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x535e80fccc309d7b%3A0x1fe41018ef75f1bd!2sMissoula%20County%2C%20MT%2C%20USA!5e0!3m2!1sen!2sca!4v1589417886050!5m2!1sen!2sca");
        from_level = covid_data.severity;
        news_data = await news.getNewsData("missoula county");
    }
    if (to_region === "working new york city") {
        covid_data = await covid.getCoviddata("https://www.trackcorona.live/api/cities/New%20York%20City%20County,%20New%20York", "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d96816.71580736949!2d-74.10232139726193!3d40.68449177006647!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x89c24fa5d33f083b%3A0xc80b8f06e177fe62!2sNew%20York%2C%20NY%2C%20USA!5e0!3m2!1sen!2sca!4v1588876513294!5m2!1sen!2sca"); 
        to_level = covid_data.severity;
        news_data = await news.getNewsData("new york city");
    }
    else if (to_region === "working bennington county") {
        covid_data = await covid.getCoviddata("https://www.trackcorona.live/api/cities/Bennington%20County,%20Vermont", "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d373334.9062946348!2d-73.33534724180068!3d43.027144239937876!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x89e03f2564ff8b3b%3A0xdca1986708336013!2sBennington%20County%2C%20VT%2C%20USA!5e0!3m2!1sen!2sca!4v1589417941015!5m2!1sen!2sca"); 
        to_level = covid_data.severity;
        news_data = await news.getNewsData("bennington county");  
    }
    if (product_info === "HP servers amazon") {
        amazon_server_data = await amazon.getAmazonData("./info/windows.txt");
        stock = amazon_server_data.inStock;
    }
    else if (product_info === "Lenovo servers amazon") {
        amazon_server_data = await amazon.getAmazonData("./info/lenovo.txt");
        stock = amazon_server_data.inStock;
    }

    // convert data points into phrase
    var phrase = [];
    if (stock) phrase.push(stock);
    if (from_level) phrase.push(from_level);
    if (to_level) phrase.push(to_level);
    console.log("PHRASE:", phrase);

    // get suggestions from phase
    const suggestions_model = JSON.parse(fse.readFileSync("./json/suggestions_knowledge_base.json", "utf8"));
    var suggestions = suggestions_model.filter(d => {
        var found = false;
        phrase.forEach(x => {
            if (d.input.indexOf(x) !== -1) {
                found = true;
            }
        });
        return found;
    });

    var final_obj = {
        data_points : {
            covid_data : covid_data,
            amazon_server_data : amazon_server_data,
            news_data: news_data
        },
        suggestions : suggestions
    };

    setTimeout(function() {
        res.json(final_obj);
    }, 2 * 1000);
});

var privateKey  = fse.readFileSync('sslcert/key.pem', 'utf8');
var certificate = fse.readFileSync('sslcert/cert.pem', 'utf8');
var credentials = {key: privateKey, cert: certificate};
var httpsServer = https.createServer(credentials, app);

httpsServer.listen(process.env.PORT || 3000, function () {
    var host = httpsServer.address().address;
    var port = httpsServer.address().port;

    console.log('NegotiationBuddy started at https://%s:%s', host, port);
});