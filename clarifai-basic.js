(function(){

function Clarifai(options){
    var validate = this.validateConstructor(options);
    if(validate === false){
        return false;
    }
    this.collectionCreated = false;
    this.addDocumentQueue = [];
    this.baseUrl = options.baseUrl || 'https://api-alpha.clarifai.com/v1/';
    this.debug = true;
    if(options.debug === false){
        this.debug = false;
    }
    this.collectionId = options.collectionId || 'default';
    this.nameSpace = options.nameSpace || 'default';
    this.getAccessToken(options).then(
        this.createCollection.bind(this),
        this.onError.bind(this)
    );
}

// add a 'positive' url for a concept
Clarifai.prototype.positive = function(url, concept, callback){
    var doc = this.createDocument(url, concept, 1);
    return this.addDocumentToCollection(
        {
            'document': doc,
            'posNegString': 'positives',
            'callback': callback
        }
    );
}

// add a 'negative' url for a concept
Clarifai.prototype.negative = function(url, concept, callback){
    var doc = this.createDocument(url, concept, -1);
    return this.addDocumentToCollection(
        {
            'document': doc,
            'posNegString': 'negatives',
            'callback': callback
        }
    );
}

// Train on a Concept
Clarifai.prototype.train = function(concept, callback){
    var deferred = $.Deferred();
    var data = {
        'collection_ids': [this.collectionId]
    }
    $.ajax(
        {
            'type': 'POST',
            'contentType': 'application/json; charset=utf-8',
            'processData': false,
            'data': JSON.stringify(data),
            'url': this.baseUrl + 'curator/concepts/' + this.nameSpace + '/' + concept + '/train',
            'headers': {
                'Authorization': 'Bearer ' + this.accessToken
            }
        }
    ).then(
        function(json){
            if(json.status.status === "OK"){
                this.log("Clarifai: Train on " + concept + " success");
                var result = {
                    'success': true
                }
                deferred.resolve(result);
                callback.call(this, result);
            }
            if(json.status.status === 'ERROR'){
                this.log("Clarifai: Train on " + concept + " failed", json);
                var result = {
                    'success': false
                }
                deferred.reject(result);
                callback.call(this, result);
            }
        }.bind(this),
        function(e){
            this.log("Clarifai: Train on " + concept + " failed", e);
            var result = {
                'success': false
            }
            deferred.reject(result);
            callback.call(this, result);
        }.bind(this)
    );
    return deferred;
}

// Given a url and concept, predict whether it contains that concept
Clarifai.prototype.predict = function(url, concept, callback){
    var deferred = $.Deferred();
    var data = {
        "urls": [url]
    }
    $.ajax(
        {
            'type': 'POST',
            'contentType': 'application/json; charset=utf-8',
            'processData': false,
            'data': JSON.stringify(data),
            'url': this.baseUrl + 'curator/concepts/' + this.nameSpace + '/' + concept + '/predict',
            'headers': {
                'Authorization': 'Bearer ' + this.accessToken
            }
        }
    ).then(
        function(json){
            if(json.status.status === "OK"){
                this.log("Clarifai: Predict on " + concept + " success");
                var result = json.urls[0];
                result.success = true;
                deferred.resolve(result);
                if(callback){
                    callback.call(this, result);
                }
            }
            if(json.status.status === 'ERROR'){
                this.log("Clarifai: Predict on " + concept + " failed", json);
                var result = {
                    'success': false
                }
                deferred.reject(result);
                callback.call(this, result);
            }
        }.bind(this),
        function(e){
            this.log("Clarifai: Predict on " + concept + " failed", e);
            var result = {
                'success': false
            }
            deferred.reject(result);
            callback.call(this, result);
        }.bind(this)
    );
    return deferred;
}

// get an accessToken from localStorage or API
Clarifai.prototype.getAccessToken = function(options){
    var deferred = $.Deferred();
    var accessTokenString = localStorage.getItem('clarifai-accessToken');
    if(accessTokenString){
        var now = new Date().getTime();
        var accessToken = JSON.parse(accessTokenString);
        if(now < accessToken.expireTime){
            this.accessToken = accessToken.access_token;
            deferred.resolve(this.accessToken);
            return deferred;
        }
    }
    if(options.clientId && options.clientSecret){
        this.fetchAccessToken(options.clientId, options.clientSecret).then(
            function(json){
                var now = new Date().getTime();
                json.expireTime = now + json.expires_in;
                localStorage.setItem('clarifai-accessToken', JSON.stringify(json));
                this.accessToken = json.access_token;
                deferred.resolve(this.accessToken);
            }.bind(this),
            function(e){
                deferred.reject(e);
            }
        );
    }
    else{
        deferred.reject('need a clientId and clientSecret');
    }
    return deferred;
}

// make an API call to fetch an accessToken using
// a clientId and clientSecret
Clarifai.prototype.fetchAccessToken = function(clientId, clientSecret){
    var data = {
        'grant_type': 'client_credentials',
        'client_id': clientId,
        'client_secret': clientSecret
    }
    return $.ajax(
        {
            'type': 'POST',
            'url': this.baseUrl + 'token',
            'data': data
        }
    );
}

// make sure we got what we need in constructor
Clarifai.prototype.validateConstructor = function(options){
    if(!$){
        console.error("Please include jQuery on page for clarifai-basic.js to work");
        return false;
    }
    if(!options.clientSecret && !options.clientId){
        console.error("Please provide a clientId and clientSecret https://developer-alpha.clarifai.com/docs/auth");
        return false;
    }
    if(options.clientId && !options.clientSecret){
        console.error("Please provide a clientSecret https://developer-alpha.clarifai.com/docs/auth");
        return false;
    }
    if(options.clientSecret && !options.clientId){
        console.error("Please provide a clientId https://developer-alpha.clarifai.com/docs/auth");
        return false;
    }
    return true;
}

// create the Document with a url, concept and score
Clarifai.prototype.createDocument = function(url, concept, score){
    var docid = new Date().getTime();
    var doc = {
        "document": {
            "docid": docid,
            "media_refs": [
                {
                    "url": url,
                    "media_type": "image"
                }
            ],
            "annotation_sets": [
                {
                    "namespace": this.nameSpace,
                    "annotations": [
                        {
                            "score": score,
                            "tag": {
                                "cname": concept
                            }
                        }
                    ]
                }
            ],
            'options': {
                'want_doc_response': true,
                'recognition_options':
                    {
                        'model': 'general-v1.2'
                    }
            }
        }
    }
    return doc;
}

// add the Document to our Collection
Clarifai.prototype.addDocumentToCollection = function(obj){
    var deferred = $.Deferred();
    var url = obj.document.document.media_refs[0].url;
    this.log("Clarifai: Putting url in " + obj.posNegString + ": '" + url + "'");
    var result = {
        'type': obj.posNegString,
        'url': url
    }
    $.ajax(
        {
            'type': 'POST',
            'url': this.baseUrl + 'curator/collections/' + this.collectionId + '/documents',
            'data': JSON.stringify(obj.document),
            'processData': false,
            'contentType': 'application/json; charset=utf-8',
            'headers': {
                'Authorization': 'Bearer ' + this.accessToken
            }
        }
    ).then(
        function(json){
            if(json.status.status === "OK"){
                this.log("Clarifai: Put url in " + obj.posNegString + ": '" + url + "'");
                result.success = true;
                deferred.resolve(result);
                if(obj.callback){
                    obj.callback.call(this, result);
                }
            }
            if(json.status.status === 'ERROR'){
                console.error("Clarifai: Error: Put url in " + obj.posNegString + ": '" + url + "'", json);
                result.success = false;
                deferred.reject(result);
                if(obj.callback){
                    obj.callback.call(this, result);
                }
            }
        }.bind(this),
        function(e){
            console.error("Clarifai: Error: Put url in " + obj.posNegString + ": '" + url + "'", e);
            result.success = false;
            deferred.reject(result);
            if(obj.callback){
                obj.callback.call(this, result);
            }
        }.bind(this)
    );
    return deferred;
}

// Create a Collection. A Collection represents a group of Documents.
Clarifai.prototype.createCollection = function(){
    var deferred = $.Deferred();
    this.listCollections().then(
        function(collectionCreated){
            if(collectionCreated === true){
                var result = {
                    'success': true
                }
                deferred.resolve(result);
            }
            else{
                var data = {
                    'collection': {
                        'id': this.collectionId,
                        'settings': {
                            'max_num_docs': 100000
                        }
                    }
                }
                $.ajax(
                    {
                        'type': 'POST',
                        'url': this.baseUrl + 'curator/collections',
                        'data': JSON.stringify(data),
                        'processData': false,
                        'contentType': 'application/json; charset=utf-8',
                        'headers': {
                            'Authorization': 'Bearer ' + this.accessToken
                        }
                    }
                ).then(
                    function(json){
                        if(json.status.status === "OK"){
                            this.log("Clarifai: Collection: '" + this.collectionId + "' created");
                            this.collectionCreated = true;
                            var result = {
                                'success': true
                            }
                            deferred.resolve(result);
                        }
                        if(json.status.status === 'ERROR'){
                            if(json.status.message.indexOf('Bad request: Collection "' + this.collectionId + '" already exists for user') !== -1){
                                this.collectionCreated = true;
                                var result = {
                                    'success': true
                                }
                                deferred.resolve(result);
                            }
                            else{
                                console.error("Clarifai: Error instantiating Clarifai object", json);
                                var result = {
                                    'success': false
                                }
                                deferred.resolve(result);
                            }
                        }
                    }.bind(this),
                    function(e){
                        if(e.status === 409){
                            var result = {
                                'success': true
                            }
                            deferred.resolve(result);
                        }
                        else{
                            console.error("Clarifai: Error instantiating Clarifai object", e);
                            console.error(e.responseJSON.status_msg);
                            if(e.responseJSON.status_msg === 'Token is not valid. Please use valid tokens for a application in your account.'){
                                console.info("Please make sure you are using a valid accessToken https://developer-alpha.clarifai.com/docs/auth");
                            }
                            var result = {
                                'success': false
                            }
                            deferred.resolve(result);
                        }
                    }.bind(this)
                );
            }
        }.bind(this),
        function(e){
            deferred.reject(e);
        }.bind(this)
    );
    return deferred;
}

Clarifai.prototype.listCollections = function(){
    var deferred = $.Deferred();
    var collectionCreated = false;
    $.ajax(
        {
            'type': 'GET',
            'url': this.baseUrl + 'curator/collections',
            'contentType': 'application/json; charset=utf-8',
            'headers': {
                'Authorization': 'Bearer ' + this.accessToken
            }
        }
    ).then(
        function(json){
            if(json.status.status === 'OK'){
                for(var i = 0; i < json.collections.length; i++){
                    var collectionId = json.collections[i].id;
                    if(collectionId === this.collectionId){
                        collectionCreated = true;
                        break;
                    }
                }
            }
            deferred.resolve(collectionCreated);
        }.bind(this),
        function(e){
            console.error(e);
            deferred.reject();
        }.bind(this)
    );
    return deferred;
}

// Turn logging on or off
Clarifai.prototype.log = function(obj){
    if(this.debug === true){
        console.log(obj);
    }
}

// generic error handler
Clarifai.prototype.onError = function(e){
    console.error(e);
}
// check if we've got require
if(typeof module !== "undefined"){
    module.exports = Clarifai;
}
else{
    window.Clarifai = Clarifai;
}

}()); // end wrapper


/*
    to use:

    var clarifai = new Clarifai(
        {
            'clientId': 'YOUR_CLIENT_ID',
            'clientSecret': 'YOUR_CLIENT_SECRET'
        }
    );
    clarifai.positive('http://example.com/image.jpg', 'car', callback);
    clarifai.negative('http://example.com/another-image.jpg', 'car', callback);
    clarifai.train('car', callback);
    clarifai.predict('http://example.com/some-new-image.jpg', 'car', callback);

*/



