// instrumentation

"use strict";

(function() {
    
    function proxyMethod(obj, funcName, callback) {
        var _originalFunction = obj[funcName];
        obj[funcName] = function() {
            try {
                callback.apply(obj, arguments);
            }
            catch(e) {
                console.error("Exception in proxy callback:");
                console.trace();
            }
            return _originalFunction.apply(obj, arguments);
        }
    }
    
    function proxyAll(obj, methodsTable) {
        
    };
    
    proxyMethod(document, "createElement", function(tagName, options) {
        console.log("creating element: " + tagName);
    });
    
    proxyMethod(document, "createElementNS", function(namespaceURI, qualifiedName, options) {
        console.log("creating element: " + namespaceURI + ":" + qualifiedName);
    });
    
    var documentMethods = {
        "createElement": function(tagName, options) {
            console.log("creating element: " + tagName);
        },
        "createElementNS": function(namespaceURI, qualifiedName, options) {
            console.log("creating element: " + namespaceURI + ":" + qualifiedName);
        }
    };
    
    

})();
