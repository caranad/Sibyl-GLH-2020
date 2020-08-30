const natural = require('natural');
const fse = require('fse');

var suggestions_classifier = new natural.BayesClassifier();


// get suggestions classifier
const suggestions_model = JSON.parse(fse.readFileSync("./json/suggestions_knowledge_base.json", "utf8"));
suggestions_model.forEach((d) => {
    suggestions_classifier.addDocument(d.input, d.output);
});
suggestions_classifier.train();


var suggestions = suggestions_classifier.getClassifications(["In Stock."]);
suggestions.forEach(x => {
    var dat = x.label.split("|");
    x.label = dat[0];
    x.reason = dat[1];
});

suggestions.forEach(x => {
    console.log(x);
});