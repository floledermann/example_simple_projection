// instrumentation

//"use strict";

(function() {
    
    function proxyMethod(obj, funcName, callback) {
        var originalFunction = obj[funcName];
        obj[funcName] = function() {
            var retVal = false;
            // obj may be a prototype, so we need to use "this" to have correct runtime object reference
            try {
                retVal = callback.call(this, arguments, originalFunction);
            }
            catch(e) {
                console.error("Exception in proxy callback: " + e.message);
                console.trace();
            }
            // a bit hacky: if return value is truthy, assume function has been handled
            if (!retVal) return originalFunction.apply(this, arguments);
            return retVal;
        }
    }
    
    function proxyMethods(obj, methodsTable) {
        Object.keys(methodsTable).forEach(function(funcName) {
            proxyMethod(obj, funcName, methodsTable[funcName]);
        });
    };
    
    function proxySetter(obj, propName, callback) {
        var descriptor = Object.getOwnPropertyDescriptor(obj, propName);
        var originalFunction = descriptor.set;
        if (!originalFunction) {
            console.error("Warning: no property named " + propName + " on " + obj);
        }
        Object.defineProperty(obj, propName, {
            set: function() {
                callback.call(this, arguments, originalFunction);
                originalFunction.apply(this, arguments);
            }
        })
    }
    
/*
    proxyMethod(document, "createElement", function(tagName, options) {
        console.log("creating element: " + tagName);
    });
*/   
    
    var documentMethods = {
        "createElement": function(arguments, originalFunction) {
            // arguments: tagName, options
            //console.log("creating element: " + arguments[0]);
        },
        "createElementNS": function(arguments, originalFunction) {
            // arguments: namespaceURI, qualifiedName, options
            //console.log("creating element: " + arguments[0] + ":" + arguments[1]);
        }
    };
    
    proxyMethods(document, documentMethods);
    
    proxyMethod(EventTarget.prototype, "addEventListener", function(arguments, originalFunction) {
        // arguments: type, listener, options
        var targetName = this.tagName;
        if (!targetName && this == window) targetName = "global object (window)";
        if (!targetName && this == document) targetName = "global object (document)";
        if (!targetName) throw new Error("unknown target in EventTarget.prototype.addEventListener proxy");
        //console.log("addEventListener called: " + arguments[0] + " on " + targetName);
    });
    
    proxyMethod(Element.prototype, "setAttribute", function(arguments, originalFunction) {
        // arguments: name, value
        console.log("setAttribute: " + arguments[0] + " to " + arguments[1] + " on " + this.tagName);
    });

    proxySetter(HTMLElement.prototype, "style", function(arguments, originalFunction) {
        console.log("style set: \"" + arguments[0] + "\" on " + this.tagName);
    });

})();
