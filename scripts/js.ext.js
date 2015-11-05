if (!String.prototype.contains) String.prototype.contains = function(str) {return (this.indexOf(str) != -1)}
if (!String.prototype.startsWith) String.prototype.startsWith = function(str) {return (this.length >= str.length && this.substring(0, str.length) == str)}
if (!String.prototype.endsWith) String.prototype.endsWith = function(str) {return (this.length >= str.length && this.substring(this.length-str.length, this.length) == str)}

String.prototype.charsCode = function() {return this.split("").reduce(function(previous, current) {return previous + current.charCodeAt(0);}, 0);}
String.prototype.containsIgnoreCase = function(str) {return (this.toUpperCase().indexOf(str.toUpperCase()) != -1)}
String.prototype.toCharArray = function(bytes) {var list = bytes?new Uint8Array(this.length):new Array(this.length); list.bytes = true; for (var i = 0; i < this.length; i++) {var code = this.charCodeAt(i); if (code > 255) list.bytes = false; list[i] = code;} return list;}
String.fromCharArray = function(arr) {var binary = ""; try {binary = String.fromCharCode.apply(null, arr);} catch(e) {for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);} return binary;}

String.prototype.pad = function(length, char) {return (this.length < length)?new Array(length - this.length + 1).join(char || "-") + this:this.toString();}
Number.prototype.pad = function(length) {return (String(this).length < length)?new Array(length - String(this).length + 1).join(0) + String(this):this.toString();}

Number.prototype.toFloat32 = function() {var fa32 = new Float32Array(1); fa32[0] = this; return fa32[0];}

Object.defineProperty(Array.prototype, "first", {get: function() {return this[0];}});
Object.defineProperty(Array.prototype, "last", {get: function() {return this[this.length-1];}});

Array.prototype.contains = function(value) {return this.indexOf(value) > -1;}
// Array.prototype.first = function() {return this[0];}
// Array.prototype.last = function() {return this[this.length-1];}
Array.prototype.clone = function() {var result = new Array(); this.forEach(function(value) {result.push(Object.clone(value));}); return result;}
Array.prototype.pushArray = function() {this.push.apply(this, this.concat.apply([], arguments));}
Array.prototype.add = function(item) {if (!this.contains(item)) return this.push(item);}
Array.prototype.remove = function(element) {return this.removeAt(this.indexOf(element));}
Array.prototype.removeAt = function(idx) {if (idx > -1) this.splice(idx, 1); return this;}
Array.prototype.replace = function(element, replaceWith) {
	var index = this.indexOf(element);

	if (index > -1) {
		if (replaceWith instanceof Array) {
			var args = [index, 1];

			for (var i = 0; i < replaceWith.length; i++)
				args.push(replaceWith[i]);

			this.splice.apply(this, args);
		}
		else
			this.splice(index, 1, replaceWith);
	}

	return this;
}

Array.protoTypedArrays = function() {
	["Int8", "Uint8", "Uint8Clamped", "Int16", "Uint16", "Int32", "Uint32", "Float32", "Float64"].forEach(function(type) {
		var typedArray = eval(type + "Array");

		if (typedArray.from)
			Array.prototype["to" + type + "Array"] = function() {return typedArray.from(this);}
		else
			Array.prototype["to" + type + "Array"] = function() {return new typedArray(this);}

		if (Array.from)
			typedArray.prototype.toArray = function() {return Array.from(this);}
		else
			typedArray.prototype.toArray = function() {return Array.prototype.slice.call(this);}
	});
}

Array.protoTypedArrays();
delete Array.protoTypedArrays;

// Float32Array.prototype.clone = function() {var result = new Float32Array(this.length); for (var i = 0; i < this.length; i++) result[i] = this[i]; return result;}
Float32Array.prototype.clone = function() {return new Float32Array(this, this.byteOffset, this.length);}

// Matrx 4 x 4
Object.defineProperty(Array.prototype, "m00", {set: function(value) {this[0] = value;}, get: function() {return this[0];}});
Object.defineProperty(Array.prototype, "m01", {set: function(value) {this[1] = value;}, get: function() {return this[1];}});
Object.defineProperty(Array.prototype, "m02", {set: function(value) {this[2] = value;}, get: function() {return this[2];}});
Object.defineProperty(Array.prototype, "m03", {set: function(value) {this[3] = value;}, get: function() {return this[3];}});

Object.defineProperty(Array.prototype, "m10", {set: function(value) {this[4] = value;}, get: function() {return this[4];}});
Object.defineProperty(Array.prototype, "m11", {set: function(value) {this[5] = value;}, get: function() {return this[5];}});
Object.defineProperty(Array.prototype, "m12", {set: function(value) {this[6] = value;}, get: function() {return this[6];}});
Object.defineProperty(Array.prototype, "m13", {set: function(value) {this[7] = value;}, get: function() {return this[7];}});

Object.defineProperty(Array.prototype, "m20", {set: function(value) {this[8] = value;}, get: function() {return this[8];}});
Object.defineProperty(Array.prototype, "m21", {set: function(value) {this[9] = value;}, get: function() {return this[9];}});
Object.defineProperty(Array.prototype, "m22", {set: function(value) {this[10] = value;}, get: function() {return this[10];}});
Object.defineProperty(Array.prototype, "m23", {set: function(value) {this[11] = value;}, get: function() {return this[11];}});

Object.defineProperty(Array.prototype, "m30", {set: function(value) {this[12] = value;}, get: function() {return this[12];}});
Object.defineProperty(Array.prototype, "m31", {set: function(value) {this[13] = value;}, get: function() {return this[13];}});
Object.defineProperty(Array.prototype, "m32", {set: function(value) {this[14] = value;}, get: function() {return this[14];}});
Object.defineProperty(Array.prototype, "m33", {set: function(value) {this[15] = value;}, get: function() {return this[15];}});

if (!Function.name) Function.name = "Function";
if (!Array.prototype.constructor.name) Array.prototype.constructor.name = "Array";

Function.create = function(name, body) {
	return new Function("body", "return function " + name + "() {return body.apply(this, arguments);};")(body || function() {});
}

Function.prototype.getName = function() {var m = this.toString().match(/^function\s(\w+)/); return m?m[1]:"anonymous";}
Function.prototype.getArguments = function() {return this.toString().match(/\((.*)\)/)[1].replace(/\s*/g, "").split(",");}
Function.prototype.getBody = function() {return this.toString().match(/\{([\s\S]*)\}/m)[1].replace(/^\s*\/\/.*$/mg, "");}

Function.prototype.construct = function(oThis) {
	var fnArguments = arguments.callee.caller.arguments;

	this.getArguments().forEach(function(name, i) {
		this[name] = fnArguments[i];
	}, oThis);
}

Function.prototype.createEnum = function(name, keys) {
	if (this[name]) throw new Error("Already exists key: " + name);
	this[name] = new Object();

	for (var i = 0; i < keys.length; i++) {
		var value = name + "_" + keys[i];
		var type = this[name];

		type[keys[i]] = (function() {
			var enm = Object.create(Object.prototype, {
				constructor: {value: Function.create(value)},
				type: {value: name},
				name: {value: keys[i]},
				value: {value: i}
			});

			Object.defineProperty(type, i, {get: function() {return enm;}});

			return enm;
		})();
	}
}

Function.prototype.argsToJSON = function(defaults) {
	var json = {};
	if (!defaults) defaults = {};
	var fnArguments = arguments.callee.caller.arguments;

	this.getArguments().forEach(function(name, i) {
		json[name] = fnArguments[i];
		if (typeof json[name] == "undefined" && name in defaults) json[name] = defaults[name];
	});

	return json;
}
/*
Object.extend = function(o, data, override) {
	for (property in data) {
		if (!override && o[property]) o["_" + property] = o[property];
		o[property] = data[property];
	}
}
*/
Object.extend = function(o, data, replace) {
	var override = false;
	var parent = replace?o.$parent:null;

	if (!parent && !replace) {
		parent = new Object();
		parent["$$"] = new Object();

		if (!o.hasOwnProperty("super")) {
			Object.defineProperty(o, "super", {
				get: function() {
					var result;
					var caller = arguments.callee.caller;

					if (!caller)
						throw "\"super\" not applicable for root";

					var lvl = caller.lvl;

					if (lvl > 0) {
						var result = this.$parent;

						while (result["$$"].lvl > lvl - 1)
							result = result.$parent;
					}
					else
						result = this.$parent;

					result["$$"].context = this;
					return result;
				}
			});
		}
	}

	for (property in data) {
		if (typeof o[property] == "function" && parent != null) {
			if (!replace)
				parent["$$"][property] = o[property];

			(function(property) {
				parent[property] = Function.create(property, function() {
					var context = this["$$"].context;
					if (!context) throw new Error("Context not found in \"" + arguments.callee.caller.getName() + "\". Use 'bind' method with 'this' as argument.");

					return this["$$"][property].apply(context, arguments);
				});
			})(property);

			o[property] = data[property];

			override = true;
		}
		else if (typeof o[property] == "object")
			Object.extend(o[property], data[property], replace);
		else
			o[property] = data[property];
	}

	if (override && !replace) {
		if (o.$parent) {
			parent.$parent = o.$parent;
			parent["$$"].lvl = o.$parent["$$"].lvl + 1;

			for (property in parent.$parent) {
				if (typeof parent.$parent[property] == "function" && typeof parent[property] == "undefined") {
					(function(property) {
						parent[property] = Function.create(property, function() {
							if (!this.$parent["$$"].context) this.$parent["$$"].context = this["$$"].context;
							return this.$parent[property].apply(this.$parent, arguments);
						});
					})(property);
				}
			}
		}
		else
			parent["$$"].lvl = 1;

		for (property in parent["$$"]) {
			if (typeof parent["$$"][property] == "function")
				parent["$$"][property].lvl = parent["$$"].lvl;
		}

		o.$parent = parent;
	}
}

Object.equals = function(x, y) {
	// if both x and y are null or undefined and exactly the same
	if (x === y) return true;

	// if they are not strictly equal, they both need to be Objects
	if (!(x instanceof Object && y instanceof Object)) return false;

	// they must have the exact same prototype chain, the closest we can do is test there constructor.
	if (x.constructor !== y.constructor) return false;

	for (var p in x) {
		// other properties were tested using x.constructor === y.constructor
		if (!x.hasOwnProperty(p)) continue;

		// allows to compare x[p] and y[p] when set to undefined
		if (!y.hasOwnProperty(p)) return false;

		// if they have the same strict value or identity then they are equal
		if (x[p] === y[p]) continue;

		// Numbers, Strings, Functions, Booleans must be strictly equal
		if (typeof(x[p]) !== "object") return false;

		// Objects and Arrays must be tested recursively
		if (!Object.equals(x[p], y[p])) return false;
	}

	for (p in y) {
		// allows x[p] to be set to undefined
		if (y.hasOwnProperty(p) && !x.hasOwnProperty(p)) return false;
	}

	return true;
}

Object.clone = function(oReferance) {
	var aReferances = new Array();

	function deepCopy(oSource) {
		if (oSource === null) return null;
		if (typeof(oSource) !== "object" || oSource.mutable) return oSource;
		if (typeof oSource.clone === "function") return oSource.clone();

		for (var i = 0; i < aReferances.length; i++) {
			if (aReferances[i][0] === oSource)
				return aReferances[i][1];
		}

		var oCopy = Object.create(Object.getPrototypeOf(oSource));
		aReferances.push([oSource, oCopy]);

		for (sPropertyName in oSource) {
			if (oSource.hasOwnProperty(sPropertyName))
				oCopy[sPropertyName] = deepCopy(oSource[sPropertyName]);
		}

		return oCopy;
	}

	return deepCopy(oReferance);
}

JSON.toBase64 = function(json) {
	return btoa(JSON.stringify(json));
}

JSON.fromBase64 = function(base64) {
	return JSON.parse(atob(base64));
}

JSON.encode = function(json) {
	var base64 = JSON.toBase64(json);
	return base64.toCharArray(true);
}

JSON.decode = function(bytes) {
	var base64 = String.fromCharArray(bytes);
	return JSON.fromBase64(base64);
}

Math.toDegrees = function(angle) {return angle * (180 / this.PI);}
Math.toRadians = function(angle) {return angle * (this.PI / 180);}
Math.randomInt = function(min, max) {return Math.floor(this.random() * (max - min + 1)) + min;}

HTMLElement.prototype.getInlineStyle = function(property) {
	return this.style[property] || this.style["-webkit-" + property] || this.style["-moz-" + property] || this.style["-ms-" + property] || this.style["-o-" + property] || "";
}

HTMLElement.prototype.getStyle = function(property) {
	var value = property;
	var vendorPrefixed = property.startsWith("-");
	if (vendorPrefixed) value = property.substring(1);

	var arr = value.split("-");
	for (var i = arr.length-1; i > 0; i--) arr[i] = arr[i].substring(0, 1).toUpperCase() + arr[i].substring(1);
	value = arr.join("");

	// Firefox else IE
	var result = window.getComputedStyle?document.defaultView.getComputedStyle(this, null)[value]:this.currentStyle[value];

	if (!vendorPrefixed && typeof result === "undefined") {
		var prefixList = ["-webkit", "-moz", "-ms", "-o"];

		for (var i = 0; i < prefixList.length; i++) {
			result = this.getStyle(prefixList[i] + "-" + property);
			if (result != "undefined") break;
		}
	}

	return result;
}

HTMLElement.prototype.getMathStyle = function(property, inline) {
	return inline?parseFloat(this.getInlineStyle(property)):parseFloat(this.getStyle(property));
}

HTMLElement.prototype.getTransformStyle = function(name) {
	var result = 0;
	var transform = this.getInlineStyle("transform");
	var match = transform.match(new RegExp(name + "\\(.+?\\)"));

	if (match) {
		transform = match[0].substring(name.length+1, match[0].length-1);
		var arr = transform.split(", ");

		if (arr.length == 1)
			result = parseFloat(transform) || 0;
		else if (arr.length == 2)
			result = {x: parseFloat(arr[0]), y: parseFloat(arr[1])};
		else if (arr.length == 3)
			result = {x: parseFloat(arr[0]), y: parseFloat(arr[1]), z: parseFloat(arr[2])};
		else if (arr.length == 4)
			result = {x: parseFloat(arr[0]), y: parseFloat(arr[1]), z: parseFloat(arr[2]), angle: parseFloat(arr[3])};
		else {
			result = new Array();

			arr.forEach(function(value) {
				result.push(parseFloat(value));
			});
		}
	}

	return result;
}

/**
 * type xy location possible values: TL, BR, TR, BL, default is TL
 */
HTMLElement.prototype.toRect = function(type) {
	var rect = new Object();
	var alpha = this.getTransformStyle("rotate");
	var offset = $(this).offset();

	rect.width = this.getMathStyle("width");
	rect.height = this.getMathStyle("height");
	rect.offsetWidth = this.offsetWidth;
	rect.offsetHeight = this.offsetHeight;
	rect.fullWidth = this.offsetWidth + this.getMathStyle("margin-left") + this.getMathStyle("margin-right");
	rect.fullHeight = this.offsetHeight + this.getMathStyle("margin-top") + this.getMathStyle("margin-bottom");
	rect.center = {x: rect.width/2, y: rect.height / 2};

	rect.rotationFrameWidth = rect.width*Math.abs(Math.cos(alpha)) + rect.height*Math.abs(Math.sin(alpha));
	rect.rotationFrameHeight = rect.width*Math.abs(Math.sin(alpha)) + rect.height*Math.abs(Math.cos(alpha));
	rect.rotationCenter = {x: rect.rotationFrameWidth/2, y: rect.rotationFrameHeight / 2};

	if (this.getStyle("position") == "absolute") {
		if ((type || "TL") == "TL") {
			rect.left = this.getMathStyle("left");
			rect.top = this.getMathStyle("top");
			rect.right = rect.left + rect.width;
			rect.bottom = rect.top + rect.height;

			rect.x = rect.left;
			rect.y = rect.top;
		}
		else if (type == "BR") {
			rect.right = this.getMathStyle("right");
			rect.bottom = this.getMathStyle("bottom");
			rect.left = rect.right + rect.width;
			rect.top = rect.bottom + rect.height;

			rect.x = rect.right;
			rect.y = rect.bottom;
		}
		else if (type == "TR") {
			rect.right = this.getMathStyle("right");
			rect.top = this.getMathStyle("top");
			rect.left = rect.right + rect.width;
			rect.bottom = rect.top + rect.height;

			rect.x = rect.right;
			rect.y = rect.top;
		}
		else if (type == "BL") {
			rect.left = this.getMathStyle("left");
			rect.bottom = this.getMathStyle("bottom");
			rect.right = rect.left + rect.width;
			rect.top = rect.bottom + rect.height;

			rect.x = rect.left;
			rect.y = rect.bottom;
		}
		else
			throw new Error("Invalid rect type: " + type + ". Possible values: TL, BR, TR, BL");
	}
	else {
		rect.left = this.offsetLeft;
		rect.top = this.offsetTop;
		rect.right = rect.left + rect.width;
		rect.bottom = rect.top + rect.height;

		rect.x = rect.left;
		rect.y = rect.top;
	}

	rect.centerOnParent = {x: rect.left + rect.rotationCenter.x, y: rect.top + rect.rotationCenter.y};
	rect.centerOnScreen = {x: offset.left + rect.rotationCenter.x, y: offset.top + rect.rotationCenter.y};

	return rect;
}

HTMLImageElement.prototype.toDataURL = function(type) {
	var canvas = document.createElement("canvas");
	canvas.width = this.width;
	canvas.height = this.height;
	canvas.getContext("2d").drawImage(this, 0, 0);

	return canvas.toDataURL(type || "image/png");
}

HTMLImageElement.prototype.toBlob = function(type) {
	return new Blob([this.getBytes(type).buffer], {type: type || "image/png"});
}

HTMLImageElement.prototype.getBytes = function(type) {
	var dataURL = this.toDataURL(type);
	var base64 = dataURL.split(",")[1];
	// var mime = dataURL.split(",")[0].split(":")[1].split(";")[0];

	return atob(base64).toCharArray(true);
}

Image.fromBytes = function(bytes, callback, type) {
	var image = new Image();

	image.onload = function () {
		URL.revokeObjectURL(this.src);
		if (callback) callback.call(this);
	}

	image.src = URL.createObjectURL(new Blob([bytes.buffer], {type : "image/" + (type || "png")}));

	return image;
}

CanvasRenderingContext2D.prototype.clearCanvas = function() {
	this.clearRect(0, 0, this.canvas.width, this.canvas.height);
}

Object.defineProperty(Screen.prototype, "deviceWidth", {get: function() {
	var width = this.width;

	if (!window.matchMedia("(-webkit-device-pixel-ratio)").matches) {
		width = Math.ceil(width * window.devicePixelRatio);

		if (width % 10 != 0) {
			if (width % 10 > 5)
				width += (10 - width % 10);
			else
				width -= width % 10;
		}
	}

	return width;
}});

Object.defineProperty(Screen.prototype, "deviceHeight", {get: function() {
	var height = this.height;

	if (!window.matchMedia("(-webkit-device-pixel-ratio)").matches) {
		height = Math.ceil(height * window.devicePixelRatio);

		if (height % 10 != 0) {
			if (height % 10 > 5)
				height += (10 - height % 10);
			else
				height -= height % 10;
		}
	}

	return height;
}});