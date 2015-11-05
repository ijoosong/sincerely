/**
 * @namespace Module
 *
 * @description connect to canvas
 */
/*
For local usagse:
	Firefox: "security.fileuri.strict_origin_policy" should be false, parameter can be found in about:config
	Chrome: start with parameter "--allow-access-from-files"
*/
var Module = {
	preRun: [],
	postRun: [],
	addPostScript: function(callback) {
		this.postRun.unshift(callback);
	},
	print: function(text) {
		if (text && text != "") console.log(text);
	},
	printErr: function(text) {
		text = Array.prototype.slice.call(arguments).join(" ");

		if (0) // XXX disabled for safety typeof dump == "function") {
			dump(text + "\n"); // fast, straight to the real console
		else
			console.log(text);
	},
	canvas: null,
	canvasID: "canvas",
	// setStatus: function(text) {},

	totalDependencies: 0,
	monitorRunDependencies: function(left) {
		this.totalDependencies = Math.max(this.totalDependencies, left);
		// Module.setStatus(left?"Preparing... (" + (this.totalDependencies-left) + "/" + this.totalDependencies + ")":"All downloads complete.");
	}
};

document.addEventListener("DOMContentLoaded", function(e) {
	Module.canvas = document.getElementById(Module.canvasID);
});

Module.initMemoryInitializerPrefixURL = (function() {
	var scripts = document.getElementsByTagName("script");

	for (var i = 0; i < scripts.length; i++) {
		if (scripts[i].src.contains("Module.js")) {
			var src = scripts[i].getAttribute("src");

			if (src.contains("/"))
				src = src.substring(0, src.lastIndexOf("/")+1);

			Module.memoryInitializerPrefixURL = src;
			break;
		}
	};
})();

Module.addPostScript(function() {
	Object.defineProperty(Module.VectorFloat.prototype, "length", {get: function() {return this.size();}});
	Object.defineProperty(Module.VectorUnsignedInt.prototype, "length", {get: function() {return this.size();}});
	Object.defineProperty(Module.PathBuilder.prototype, "stride", {get: function() {return this.calculateStride();}});
	Object.defineProperty(Module.InkDecoder.prototype, "path", {get: function() {return {points: this.getPoints(), stride: this.ink.stride};}});
	Object.defineProperty(Module.InkDecoder.prototype, "paint", {get: function() {return this.ink.paint.null?null:this.ink.paint.value;}});

	Module.VectorFloat.fromFloat32Array = function(af32) {
		var result = new Module.VectorFloat();
		// result.resize(af32.length, 0);
		// for (var i = 0; i < af32.length; i++) result.set(i, af32[i]);
		for (var i = 0; i < af32.length; i++) result.push(af32[i]);
		return result;
	}

	Module.VectorUnsignedInt.fromUint32Array = function(ui32) {
		var result = new Module.VectorUnsignedInt();
		// result.resize(ui32.length, 0);
		for (var i = 0; i < ui32.length; i++) result.push(ui32[i]);
		// for (var i = 0; i < ui32.length; i++) result.set(i, ui32[i]);
		return result;
	}

	Object.extend(Module.VectorFloat.prototype, {
		push: Module.VectorFloat.prototype.push_back,

		equals: function(vec) {
			var result = this.size() == vec.size();

			if (result) {
				for (var i = 0; i < this.size(); i++) {
					if (this.get(i) != vec.get(i)) {
						result = false;
						break;
					}
				}
			}

			return result;
		},

		forEach: function(callback, context) {
			for (var i = 0; i < this.size(); i++)
				callback.call(context || {}, this.get(i), i, this);
		},

		toFloat32Array: function() {
			var result = new Float32Array(this.size());
			for (var i = 0; i < this.size(); i++) result[i] = this.get(i);
			return result;
		},

		toArray: function() {
			var result = new Array();
			for (var i = 0; i < this.size(); i++) result.push(this.get(i));
			return result;
		},

		toString: function() {
			return this.toArray().toString();
		}
	});

	Object.extend(Module.VectorUnsignedInt.prototype, {
		push: Module.VectorUnsignedInt.prototype.push_back,
		forEach: Module.VectorFloat.prototype.forEach,
		toArray: Module.VectorFloat.prototype.toArray,
		toString: Module.VectorFloat.prototype.toString,
	});

	Object.extend(Module.VectorInterval.prototype, {
		push: Module.VectorInterval.prototype.push_back,
		forEach: Module.VectorFloat.prototype.forEach
	});

	Object.extend(Module.PathContext.prototype, {
		getPath: Function.create("PathContext$getPath", function() {
			this.super.getPath.apply(this.super, arguments);
			return {points: this.nativeGetPath(), stride: this.stride};
		}),

		getPathPart: Function.create("PathContext$getPathPart", function() {
			this.super.getPathPart.apply(this.super, arguments);
			return {points: this.nativeGetPathPart(), stride: this.stride};
		})
	});

	Object.extend(Module.PathBuilder, {
		createPath: function(points, stride) {
			return {points: points, stride: stride};
		}
	});

	Object.extend(Module.PathBuilder.prototype, {
		createPath: Function.create("PathBuilder$createPath", function(points) {
			this.super.createPath.apply(this.super, arguments);
			return {points: points, stride: this.stride};
		}),

		addPoint: Function.create("PathBuilder$addPoint", function(phase, point, parameter) {
			this.super.addPoint(phase, point);
			return {points: this.nativeAddPoint(phase, point, parameter), stride: this.stride};
		}),

		addPathPart: Function.create("PathBuilder$addPathPart", function(pathPart) {
			this.super.addPathPart.apply(this.super, arguments);

			var pathContext;

			Module.useVectoredFloat32Array(function(points) {
				pathContext = this.nativeAddPathPart(points);
			}, this, pathPart.points);

			pathContext.stride = this.stride;

			return pathContext;
		}),

		createPreliminaryPath: Function.create("PathBuilder$createPreliminaryPath", function() {
			this.super.createPreliminaryPath.apply(this.super, arguments);
			return {points: this.nativeCreatePreliminaryPath(), stride: this.stride};
		}),

		finishPreliminaryPath: Function.create("PathBuilder$finishPreliminaryPath", function(pathEnding) {
			this.super.finishPreliminaryPath.apply(this.super, arguments);

			var path;

			Module.useVectoredFloat32Array(function(points) {
				path = {points: this.nativeFinishPreliminaryPath(points), stride: this.stride};
			}, this, pathEnding.points);

			return path;
		})
	});

	Object.extend(Module.BezierPath.prototype, {
		setStroke: Function.create("BezierPath$setStroke", function(stroke) {
			this.super.setStroke.apply(this.super, arguments);

			Module.Stroke.normalizeStrokeData(stroke);

			this.color = isNaN(stroke.color.alpha)?Module.color.from(stroke.color):stroke.color;

			Module.useVectoredFloat32Array(function(points) {
				this.init(points, stroke.path.stride, stroke.width, stroke.ts, stroke.tf);
			}, this, stroke.path.points);
		})
	});

	CanvasRenderingContext2D.prototype.drawBezierPath = function(bezierPath) {
		if (!(bezierPath instanceof Module.BezierPath)) throw new Error("bezierPath argument is not instance of Module.BezierPath");

		this.fillStyle = "rgba(" + Module.color.toArray(bezierPath.color).join(", ") + ")";
		this.beginPath();

		for (var i = 0; i < bezierPath.length; i++) {
			var boundary = bezierPath.boundaryAt(i);

			this.moveTo(boundary.startingPoint.x, boundary.startingPoint.y);

			for (var j = 0; j < boundary.length; j++) {
				var curve = boundary.curveAt(j);
				this.bezierCurveTo(curve.cp1.x, curve.cp1.y, curve.cp2.x, curve.cp2.y, curve.p.x, curve.p.y);
			}

			this.closePath();
		}

		this.fill();
	}

	Object.extend(Module.MultiChannelSmoothener.prototype, {
		smooth: Function.create("MultiChannelSmoothener$smooth", function(pathPart, finish) {
			this.super.smooth.apply(this.super, arguments);

			var path;

			Module.useVectoredFloat32Array(function(points) {
				path = {points: this.nativeSmooth(points, finish), stride: pathPart.stride};
			}, this, pathPart.points);

			return path;
		})
	});

	Object.extend(Module.ParticleBrush.prototype, {
		configureShape: function(src) {
			GLTools.prepareTexture(this.shapeTexture, src);
		},

		configureFill: function(src) {
			GLTools.prepareTexture(this.fillTexture, src, function(texture) {
				this.setFillTextureSize(texture.image.width, texture.image.height);
			}, this);
		}
	});

	Object.extend(Module.GenericLayer.prototype, {
		draw: Function.create("GenericLayer$draw", function(stroke) {
			this.super.draw.apply(this.super, arguments);
			if (!Module.Stroke.validatePath(stroke.path)) return null;

			var dirtyArea;
			var drawContext = null;

			if (stroke.brush instanceof Module.ParticleBrush && stroke.randomSeed > 0) {
				drawContext = new Module.StrokeDrawContext();
				drawContext.randomSeed = stroke.randomSeed;
			}

			Module.useVectoredFloat32Array(function(points) {
				dirtyArea = this.nativeDrawStroke(stroke.brush, points, stroke.path.stride, stroke.width, stroke.color, true, true, stroke.ts, stroke.tf, drawContext);
			}, this, stroke.path.points);

			if (drawContext) drawContext.delete();
			return dirtyArea;
		}),

		drawStroke: Function.create("GenericLayer$drawStroke", function(brush, path, width, color, roundCapBeggining, roundCapEnding, ts, tf, drawContext) {
			this.super.drawStroke.apply(this.super, arguments);
			if (!Module.Stroke.validatePath(path)) return null;

			var dirtyArea;

			Module.useVectoredFloat32Array(function(points) {
				dirtyArea = this.nativeDrawStroke(brush, points, path.stride, width, color, roundCapBeggining, roundCapEnding, ts, tf, drawContext);
			}, this, path.points);

			return dirtyArea;
		}),

		fillPath: Function.create("GenericLayer$fillPath", function(path, color, antiAliasing) {
			this.super.fillPath.apply(this.super, arguments);
			if (!Module.Stroke.validatePath(path)) return;

			Module.useVectoredFloat32Array(function(points) {
				this.nativeFillPath(points, path.stride, color, antiAliasing);
			}, this, path.points);
		}),

		/*
			{
				Mode: Module.BlendMode,
				Rect: Module.Rectangle,
				SourceRect: Module.Rectangle,
				DestinationRect: Module.Rectangle,
				Transform: Module.Mat4,
				SourceTransform: Module.Mat4,
				DestinationTransform: Module.Mat4,
			}
		*/
		blend: Function.create("GenericLayer$blend", function(source, options) {
			this.super.blend(source, options || {});

			//////// delete on next release
			if (options && options.type && options.type == "BlendMode") {
				options = {Mode: options};
				console.warn("Layer$blend method usage with second parameter BlendMode is deprecated. It will be removed soon. Please use BlendOptions as second parameter.");
			}

			if (!options) options = {};
			if (!options["Mode"]) options["Mode"] = Module.BlendMode.NORMAL;

			if (options["SourceTransform"] && options["DestinationTransform"]) {
				if (options["SourceRect"] && options["DestinationRect"])
					this.blendWithRectsTransform(source, options["SourceRect"], options["SourceTransform"], options["DestinationRect"], options["DestinationTransform"], options["Mode"]);
				else
					throw new Error("With SourceTransform and DestinationTransform - SourceRect and DestinationRect are required");
			}
			else if (options["Transform"]) {
				if (options["Rect"])
					this.blendWithRectTransform(source, options["Rect"], options["Transform"], options["Mode"]);
				else
					this.blendWithTransform(source, options["Transform"], options["Mode"]);
			}
			else if (options["SourceRect"] && options["DestinationRect"])
				this.blendWithRects(source, options["SourceRect"], options["DestinationRect"], options["Mode"]);
			else if (options["Rect"])
				this.blendWithRect(source, options["Rect"], options["Mode"]);
			else
				this.blendWithMode(source, options["Mode"]);
		}),

		readPixels: function(rect) {
			if (!rect) rect = this.bounds;

			var int64Ptr = new Object();
			int64Ptr.length = rect.width * rect.height * 4;

			var ptr = Module._malloc(int64Ptr.length);
			int64Ptr.ptr = ptr;

			this.nativeReadPixels(int64Ptr.ptr, rect);

			var bytes = Module.readBytes(int64Ptr);
			Module._free(ptr);

			return bytes;
		},

		writePixels: function(bytes, rect) {
			if (!bytes) throw new Error("GenericLayer$writePixels 'bytes' parameter is required");
			if (!(bytes instanceof Uint8Array)) throw new Error("GenericLayer$writePixels 'bytes' parameter is not instance of Uint8Array");
			if (!rect) rect = this.bounds;

			Module.writeBytes(bytes, function(int64Ptr) {
				this.nativeWritePixels(int64Ptr.ptr, rect);
			}, this);
		}
	});

	Object.extend(Module.Intersector.prototype, {
		setTargetAsStroke: Function.create("Intersector$setTargetAsStroke", function(path, width) {
			this.super.setTargetAsStroke.apply(this.super, arguments);

			Module.useVectoredFloat32Array(function(points) {
				this.nativeSetTargetAsStroke(points, path.stride, width);
			}, this, path.points);
		}),

		setTargetAsClosedPath: Function.create("Intersector$setTargetAsClosedPath", function(path) {
			this.super.setTargetAsClosedPath.apply(this.super, arguments);

			Module.useVectoredFloat32Array(function(points) {
				this.nativeSetTargetAsClosedPath(points, path.stride);
			}, this, path.points);
		}),

		isIntersectingTarget: Function.create("Intersector$isIntersectingTarget", function(stroke) {
			this.super.isIntersectingTarget.apply(this.super, arguments);

			var result;

			Module.useVectoredFloat32Array(function(points, segments) {
				result = this.nativeIsIntersectingTarget(points, stroke.path.stride, stroke.width, stroke.ts, stroke.tf, stroke.path.bounds, segments);
			}, this, stroke.path.points, stroke.path.segments.toFloat32Array());

			return result;
		}),

		intersectWithTarget: Function.create("Intersector$intersectWithTarget", function(stroke) {
			this.super.intersectWithTarget.apply(this.super, arguments);

			var intervals;

			Module.useVectoredFloat32Array(function(points, segments) {
				intervals = this.nativeIntersectWithTarget(points, stroke.path.stride, stroke.width, stroke.ts, stroke.tf, stroke.path.bounds, segments);
			}, this, stroke.path.points, stroke.path.segments.toFloat32Array());

			return intervals;
		})
	});

	Object.extend(Module.InkEncoder, {
		encode: function(strokes) {
			var bytes;
			var encoder = new Module.InkEncoder();

			strokes.forEach(function(stroke) {
				encoder.encode(stroke);
			}, this);

			bytes = Module.readBytes(encoder.getBytes());
			encoder.delete();

			return bytes;
		}
	});

	Object.extend(Module.InkEncoder.prototype, {
		encode: Function.create("InkEncoder$encode", function(stroke, paint) {
			this.super.encode(stroke);

			var ink = {
				precision: stroke.encodePrecision || 2,
				stride: stroke.path.stride,
				width: stroke.width,
				color: stroke.color,
				ts: stroke.ts,
				tf: stroke.tf,
				randomSeed: stroke.randomSeed,
				blendMode: stroke.blendMode,
				paint: Module.getUnsignedInt((paint != null && !isNaN(paint))?paint:stroke.brush.id),
				id: Module.getUnsignedInt(stroke.id)
			};

			Module.useVectoredFloat32Array(function(points) {
				this.nativeEncode(ink, points);
			}, this, stroke.path.points);
		})
	});

	Object.extend(Module.InkDecoder, {
		decode: function(bytes) {
			var strokes = new Array();
			var stroke;
			var dirtyArea;

			Module.writeBytes(bytes, function(int64Ptr) {
				var decoder = new Module.InkDecoder(int64Ptr);

				while (decoder.hasNext()) {
					stroke = decoder.decode();
					dirtyArea = RectTools.union(dirtyArea, stroke.bounds);

					strokes.push(stroke);
				}

				decoder.delete();
			}, this);

			strokes.dirtyArea = dirtyArea;
			return strokes;
		},

		getStrokeBrush: function(paint) {
			throw new Error("Module.InkDecoder.getStrokeBrush(paint, [user]) should be implemented");
		}
	});

	Object.extend(Module.InkDecoder.prototype, {
		decode: Function.create("InkDecoder$decode", function() {
			this.super.decode.apply(this.super, arguments);
			this.nativeDecode();

			var brush = Module.InkDecoder.getStrokeBrush(this.paint);
			return new Module.Stroke(brush, this.path, this.ink.width, this.ink.color, this.ink.ts, this.ink.tf, this.ink.randomSeed, this.ink.blendMode);
		})
	});

	Object.extend(Module.BrushEncoder.prototype, {
		encode: function(brush) {
			if (brush instanceof Module.ParticleBrush) {
				var shapes = new Module.VectorInt64Ptr();
				var fills = new Module.VectorInt64Ptr();

				this.encodeImages(brush.shapeTexture, shapes);
				this.encodeImages(brush.fillTexture, fills);

				this.encodeParticleBrush(brush, shapes, fills, Module.getUnsignedInt(brush.id));

				for (var i = 0; i < shapes.size(); i++)
					Module._free(shapes.get(i).ptr);

				for (var i = 0; i < fills.size(); i++)
					Module._free(fills.get(i).ptr);

				shapes.delete();
				fills.delete();
			}
		},

		encodeImages: function(textureID, int64Ptrs) {
			var images = GL.textures[textureID].image?[GL.textures[textureID].image]:GL.textures[textureID].mipmap;
			if (!images) throw new Error("Texture images not found");

			images.forEach(function(image) {
				// do not encode auto generated images
				if (image.src.startsWith("data:")) return;

				var bytes = image.getBytes();
				var ptr = Module._malloc(bytes.length);
				var int64Ptr = {ptr: ptr, length: bytes.length};
				Module.HEAPU8.set(bytes, ptr);

				int64Ptrs.push_back(int64Ptr);
			});
		}
	});

	Object.extend(Module.BrushDecoder.prototype, {
		decode: function() {
			this.brushes = new Array();
			this.loader = 0;

			while (this.hasNext()) {
				var id = this.getBrushID();
				var brushID = id.null?null:id.value;
				var brush = Module.InkDecoder.getStrokeBrush(brushID);

				if (!brush) {
					brush = this.getParticleBrush();
					brush.id = brushID;

					this.decodeImages(brush.shapeTexture, this.getShapes());
					this.decodeImages(brush.fillTexture, this.getFills());
				}

				this.brushes.push(brush);
			}

			if (this.loader == 0)
				this.onComplete(this.brushes);
		},

		decodeImages: function(textureID, int64Ptrs) {
			var texture = GL.textures[textureID];
			var self = this;

			this.loader += int64Ptrs.size();

			if (int64Ptrs.size() > 1) {
				var mipmap = new Array();
				var cnt = int64Ptrs.size();

				for (var i = 0; i < int64Ptrs.size(); i++) {
					var image = Image.fromBytes(Module.readBytes(int64Ptrs.get(i)), function() {
						cnt--;
						self.loader--;

						if (cnt == 0) {
							GLTools.completeMipMap(mipmap, function() {
								texture.mipmap = mipmap;
								GLTools.initTexture(texture);

								if (self.loader == 0)
									self.onComplete(self.brushes);
							});
						}
					});

					mipmap.push(image);
				}
			}
			else {
				var image = Image.fromBytes(Module.readBytes(int64Ptrs.get(0)), function() {
					self.loader--;

					texture.image = this;
					GLTools.initTexture(texture);

					if (self.loader == 0)
						self.onComplete(self.brushes);
				});
			}
		},

		onComplete: function(brushes) {}
	});

	Object.extend(Module.PathOperationEncoder.prototype, {
		encodeComposeStyle: Function.create("PathOperationEncoder$encodeComposeStyle", function(style) {
			this.super.encodeComposeStyle.apply(this.super, arguments);

			var paint = null;
			if (style.brush instanceof Module.ParticleBrush && style.brush.id) paint = style.brush.id;

			this.nativeComposeStyle(style.width, style.color, style.blendMode, Module.getUnsignedInt(paint), style.randomSeed);
		}),

		encodeComposePathPart: Function.create("PathOperationEncoder$encodeComposePathPart", function(path, color, variableWidth, variableColor, endStroke) {
			this.super.encodeComposePathPart.apply(this.super, arguments);

			if (path.points.length > 0) {
				Module.useVectoredFloat32Array(function(points) {
					this.nativeComposePathPart(points, color, variableWidth, variableColor, endStroke);
				}, this, path.points);
			}
		}),

		encodeAdd: Function.create("PathOperationEncoder$encodeAdd", function(strokes) {
			this.super.encodeAdd.apply(this.super, arguments);

			var addEncoder = this.nativeAdd();

			strokes.forEach(function(stroke) {
				var ink = {
					precision: stroke.encodePrecision || 2,
					stride: stroke.path.stride,
					width: stroke.width,
					color: stroke.color,
					ts: stroke.ts,
					tf: stroke.tf,
					randomSeed: stroke.randomSeed,
					blendMode: stroke.blendMode,
					paint: Module.getUnsignedInt(stroke.brush.id),
					id: Module.getUnsignedInt(stroke.id)
				};

				Module.useVectoredFloat32Array(function(points) {
					addEncoder.encodeStroke(ink, points)
				}, this, stroke.path.points);
			}, this);

			this.flush();
		}),

		encodeSplit: Function.create("PathOperationEncoder$encodeSplit", function(splits) {
			this.super.encodeSplit.apply(this.super, arguments);

			var splitEncoder = this.nativeSplit();
			var affectedArea;

			splits.forEach(function(split) {
				var intervals = new Module.VectorInterval();
				var intervalIDs = new Module.VectorUnsignedInt();

				affectedArea = RectTools.union(affectedArea, split.dirtyArea);

				split.strokes.forEach(function(stroke) {
					var interval = {fromIndex: stroke.fromIndex, toIndex: stroke.toIndex, fromTValue: stroke.ts, toTValue: stroke.tf, inside: false};

					intervals.push(interval);
					if (stroke.id) intervalIDs.push(stroke.id);
				}, this);

				splitEncoder.encodeStroke(split.id, affectedArea, intervals, intervalIDs);

				intervalIDs.delete();
				intervals.delete();
			}, this);

			this.flush();
		})
	});

	Object.extend(Module.PathOperationDecoder, {
		getPathOperationDecoderCallbacksHandler: function(implementation) {
			var implementationFunctions = ["onComposeStyle", "onComposePathPart", "onComposeAbort", "onAdd", "onRemove", "onUpdateColor", "onUpdateBlendMode", "onSplit", "onTransform"];
			implementationFunctions.forEach(function(name) {
				if (!implementation[name] || typeof implementation[name] != "function")
					throw new Error("Implementation of \"" + name + "\" missing. Please provide implementation.");
			});

			implementation = Object.clone(implementation);

			Object.extend(implementation, {
				composeStyle: function(user, style, paint) {
					style.brush = Module.InkDecoder.getStrokeBrush(paint, user);
					return style;
				},

				composePathPart: function(points, stride) {
					return Module.PathBuilder.createPath(points.toFloat32Array(), stride);
				},

				onAddStroke: function(user, strokes, ink, points) {
					if (!strokes) strokes = [];
					var path = Module.PathBuilder.createPath(points, ink.stride);
					var brush = Module.InkDecoder.getStrokeBrush(ink.paint.null?null:ink.paint.value, user);
					var stroke = new Module.Stroke(brush, path, ink.width, ink.color, ink.ts, ink.tf, ink.randomSeed, ink.blendMode);
					if (!ink.id.null) stroke.id = ink.id.value;

					strokes.push(stroke);

					return strokes;
				},

				onSplitStroke: function(splits, id, affectedArea, intervals, intervalIDs) {
					if (!splits) splits = new Array();
					splits.affectedArea = RectTools.union(splits.affectedArea, affectedArea);

					var split = {id: id, intervals: new Array()};
					splits.push(split);

					intervals.forEach(function(interval, i) {
						var splitInterval = {fromIndex: interval.fromIndex, toIndex: interval.toIndex, fromTValue: interval.fromTValue, toTValue: interval.toTValue};
						if (intervalIDs.length > 0) splitInterval.id = intervalIDs.get(i);

						split.intervals.push(splitInterval);
					});

					return splits;
				}
			});

			return Module.PathOperationDecoderCallbacksHandlerInterface.implement(implementation);
		}
	});

	var enums = [Module.BlendMode, Module.RotationMode, Module.PropertyName, Module.PropertyFunction, Module.InputPhase];

	enums.forEach(function(enm) {
		for (name in enm) {
			if (typeof enm[name] == "object") {
				enm[name]["name"] = name;
				enm[name]["type"] = enm[name].constructor.getName().split("_")[0];
				enm[enm[name].value] = enm[name];
			}
		}
	});
});

Module.getUnsignedInt = Module.getUnsignedLong = function(value) {
	if (value != null && !isNaN(value) && value >= 0)
		return {value: value, null: false};
	else
		return {value: 0, null: true};

	return result;
}

/**
 * Handler for prepared vectors
 *
 * @callback UseVectoredFloat32ArrayCallback
 * @param {...Module.VectorFloat} vector
 * @see Module.useVectoredFloat32Array
 */

/**
 * Constructs floatArrays count vectors, using it through callback and destructs them
 *
 * @param {UseVectoredFloat32ArrayCallback} callback
 * @param {Object} context callback context
 * @param {...(Float32Array | Array)} floatArray one or more arrays with floats as content
 * @return {*} callback result
 */
Module.useVectoredFloat32Array = function(callback, context) {
	var floatArrays = Array.prototype.slice.call(arguments, 2);
	var vectors = new Array();

	floatArrays.forEach(function(arr) {
		if (arr) {
			if (arr instanceof Module.VectorFloat) {
				arr.reference = true;
				vectors.push(arr);
			}
			else
				vectors.push(Module.VectorFloat.fromFloat32Array(arr));
		}
	});

	var result = callback.apply(context, vectors);

	vectors.forEach(function(vector) {
		if (vector.reference)
			delete vector.reference;
		else
			vector.delete();
	});

	return result;
}

/**
 * Read bytes from HEAP
 *
 * @param {Module.Int64Ptr} int64Ptr
 * @return {Uint8Array} bytes
 */
Module.readBytes = function(int64Ptr) {
	var bytes = Module.HEAPU8.subarray(int64Ptr.ptr, int64Ptr.ptr+int64Ptr.length);
	bytes = new Uint8Array(bytes, bytes.byteOffset, bytes.length);

	return bytes;
};

/**
 * Handler for extracted data
 *
 * @callback WriteBytesCallback
 * @param {Module.Int64Ptr} int64Ptr
 * @see Module.writeBytes
 */

/**
 * Write bytes to HEAP
 *
 * @param {Uint8Array} bytes
 * @param {WriteBytesCallback} callback
 * @param {Object} [context={}] callback context
 */
Module.writeBytes = function(bytes, callback, context) {
	var ptr = Module._malloc(bytes.length);
	var int64Ptr = {ptr: ptr, length: bytes.length};

	try {
		Module.HEAPU8.set(bytes, ptr);
		callback.call(context || {}, int64Ptr);
	}
	finally {
		Module._free(ptr);
	}
};

/**
 * @namespace Module.color
 *
 * @description Module.Color utils
 */
Module.color = {
	/**
	 * Represents transperent color
	 *
	 * @memberof Module.color
	 * @member {Module.Color} TRANSPERENT
	 */
	TRANSPERENT: {red: 0, green: 0, blue: 0, alpha: 0},

	/**
	 * Represents color Black
	 *
	 * @memberof Module.color
	 * @member {Module.Color} BLACK
	 */
	BLACK: {red: 0, green: 0, blue: 0, alpha: 1},

	/**
	 * Represents color White
	 *
	 * @memberof Module.color
	 * @member {Module.Color} WHITE
	 */
	WHITE: {red: 255, green: 255, blue: 255, alpha: 1},

	/**
	 * Represents color Red
	 *
	 * @memberof Module.color
	 * @member {Module.Color} RED
	 */
	RED: {red: 255, green: 0, blue: 0, alpha: 1},

	/**
	 * Represents color Green
	 *
	 * @memberof Module.color
	 * @member {Module.Color} GREEN
	 */
	GREEN: {red: 0, green: 255, blue: 0, alpha: 1},

	/**
	 * Represents color Blue
	 *
	 * @memberof Module.color
	 * @member {Module.Color} BLUE
	 */
	BLUE: {red: 0, green: 0, blue: 255, alpha: 1},

	/**
	 * Creates Module.Color object
	 *
	 * @see Module.Color
	 * @param {(int | Array)} redORrgba between 0-255 or rgba array
	 * @param {int} green between 0-255
	 * @param {int} blue between 0-255
	 * @param {float} alpha between 0-1
	 * @return {Module.Color} color
	 */
	from: function(redORrgba, green, blue, alpha) {
		var red = redORrgba;

		if (redORrgba instanceof Array) {
			var rgba = redORrgba;

			red = rgba[0];
			green = rgba[1];
			blue = rgba[2];
			alpha = rgba[3];
		}

		return {red: red, green: green, blue: blue, alpha: isNaN(alpha)?1:alpha};
	},

	/**
	 * Creates a RGBA array from color
	 *
	 * @param {Module.Color} color
	 * @return {Array} rgba array
	 */
	toArray: function(color) {
		return [color.red, color.green, color.blue, color.alpha];
	},

	/**
	 * Creates a color from hex
	 *
	 * @param {String} hex color with leading '#'
	 * @return {Module.Color} color
	 */
	fromHex: function(hex) {
		hex = hex.substring(1);
		return Module.color.from(parseInt(hex.substring(0, 2), 16), parseInt(hex.substring(2, 4), 16), parseInt(hex.substring(4, 6), 16));
	},

	/**
	 * Creates a hex string from color
	 *
	 * @param {Module.Color} color
	 * @return {String} hex string with leading '#'
	 */
	toHex: function(color) {
		return "#" + color.red.toString(16).pad(2, "0") + color.green.toString(16).pad(2, "0") + color.blue.toString(16).pad(2, "0");
	},

	random: function(alpha) {
		return {red: Math.randomInt(0, 255), green: Math.randomInt(0, 255), blue: Math.randomInt(0, 255), alpha: alpha?Math.random():1};
	}
};

/**
 * Stroke model
 *
 * @class Module.Stroke
 * @since version 1.4
 *
 * @param {Module.StrokeBrush} brush
 * @param {Module.Path} path
 * @param {float} width
 * @param {Module.Color} color
 * @param {float} ts
 * @param {float} tf
 * @param {int} [randomSeed=0]
 * @param {Module.BlendMode} [blendMode=Module.BlendMode.NORMAL]
 */
Module.Stroke = function(brush, path, width, color, ts, tf, randomSeed, blendMode) {
	this.brush = brush;
	this.brush.mutable = true;
	this.path = path;
	this.width = width;
	this.color = Object.clone(color);
	this.ts = ts;
	this.tf = tf;
	this.randomSeed = randomSeed || 0;
	this.blendMode = blendMode || Module.BlendMode.NORMAL;

	this.initPath();
}

/**
 * Stroke length
 *
 * @memberof Module.Stroke.prototype
 * @member {int} length
 */
Object.defineProperty(Module.Stroke.prototype, "length", {enumerable: true, get: function() {return this.path.length;}});

/**
 * Stroke bounds
 *
 * @memberof Module.Stroke.prototype
 * @member {Module.Rectangle} bounds
 */
Object.defineProperty(Module.Stroke.prototype, "bounds", {enumerable: true, get: function() {return this.path.bounds;}});

Object.extend(Module.Stroke, {
	/**
	 * Creates stroke point object
	 *
	 * @method Module.Stroke.createPoint
	 * @param {int} [x=Infinity]
	 * @param {int} [y=Infinity]
	 * @param {float} [width=Infinity]
	 * @param {float} [alpha=Infinity]
	 * @return {Module.Point2D} new point, with args as properties
	 */
	createPoint: function(x, y, width, alpha) {
		return arguments.callee.argsToJSON({x: Infinity, y: Infinity, width: Infinity, alpha: Infinity});
	},

	fromJSON: function(brush, data) {
		if (!data.width) data.width = NaN;
		if (!data.color.alpha) data.color.alpha = NaN;
		if (!data.path) data.path = {points: data.points, stride: data.stride};

		return new Module.Stroke(brush, data.path, data.width, data.color, data.ts, data.tf, data.randomSeed, Module.BlendMode[data.blendMode]);
	},

	validatePath: function(path) {
		if (path.points.length < 4 * path.stride) {
			if (path.points.length > 0)
				Module.printErr("WARNING: Less than needed minimum of points passed (At least 4 points are needed to define a path)!");

			return false;
		}

		if (path.points.length % path.stride != 0) {
			Module.printErr("WARNING: The points vector size (" + path.points.length + ") is should be a multiple of the stride property (" + path.stride + ")!");
			return false;
		}

		return true;
	},

	normalizeStrokeData: function(data) {
 		if (!data.path) throw new Error("StrokeData path is required");

 		if (!("width" in data)) data.width = NaN;
 		if (!("ts" in data)) data.ts = 0;
 		if (!("tf" in data)) data.tf = 1;
 		if (!("randomSeed" in data)) data.randomSeed = 0;
 		if (!("blendMode" in data)) data.blendMode = Module.BlendMode.NORMAL;
	}
});

Object.extend(Module.Stroke.prototype, {
	initPath: function() {
		Object.defineProperty(this.path, "length", {enumerable: true, get: function() {return this.points.length / this.stride;}});

		Object.extend(this.path, {
			get: function(i) {
				var base = i * this.stride;
				var point = {x: this.points[base], y: this.points[base + 1]};

				if (this.index.width > -1) point.width = this.points[base + this.index.width];
				if (this.index.alpha > -1) point.alpha = this.points[base + this.index.alpha];

				return point;
			},

			set: function(i, point) {
				var base = i * this.stride;

				this.points[base] = point.x;
				this.points[base + 1] = point.y;
				if (this.index.width > -1) this.points[base + this.index.width] = point.width;
				if (this.index.alpha > -1) this.points[base + this.index.alpha] = point.alpha;
			},

			getPart: function(fromIndex, toIndex) {
				return {
					points: this.points.subarray(fromIndex * this.stride, (toIndex+1) * this.stride),
					stride: this.stride,
					index: this.index
				};
			},

			calculateBounds: function(width, scattering) {
				this.bounds = null;
				this.segments = new Array(this.length - 3);

				this.segments.toFloat32Array = function() {
					var segments = new Float32Array(this.length * 4);

					this.forEach(function(segment, i) {
						segments[i * 4] = segment.left;
						segments[i * 4 + 1] = segment.top;
						segments[i * 4 + 2] = segment.width;
						segments[i * 4 + 3] = segment.height;
					});

					return segments;
				};

				var points = this.points;
				var vector = this.points instanceof Module.VectorFloat;
				if (!vector) points = Module.VectorFloat.fromFloat32Array(points);

				for (var i = 0; i < this.segments.length; i++) {
					var segment = Module.calculateSegmentBounds(points, this.stride, width, i, scattering || 0);

					this.segments[i] = segment;
					this.bounds = RectTools.union(this.bounds, segment);
				}

				this.bounds = RectTools.intersect(this.bounds, Module.canvas.toRect());
				this.bounds = RectTools.ceil(this.bounds);

				if (!vector) points.delete();
			}
		});

		var points = this.path.points;

		if (points instanceof Module.VectorFloat) {
			this.path.calculateBounds(this.width);
			this.path.points = points.toFloat32Array();
		}
		else {
			if (points instanceof Array)
				this.path.points = points.toFloat32Array();
			else if (!(points instanceof Float32Array))
				throw new Error("Invalid path points type");
			else if (points.byteOffset > 0)
				this.path.points = new Float32Array(points, points.byteOffset, points.length);

			this.path.calculateBounds(this.width);
		}

		if (!this.path.index) {
			this.path.index = new Object();

			switch (this.path.stride) {
				case 2:
					this.path.index.width = -1;
					this.path.index.alpha = -1;

					break;
				case 3:
					this.path.index.width = isNaN(this.width)?2:-1;;
					this.path.index.alpha = isNaN(this.width)?-1:2;;

					break;
				case 4:
					this.path.index.width = 2;
					this.path.index.alpha = 3;

					break;
				default:
					throw new Error("Invalid stride: " + this.path.stride);
			}
		}
	},

	/**
	 * @method Module.Stroke.prototype.getPoint
	 * @param {int} idx
	 * @return {Module.Point2D} point on idx
	 */
	getPoint: function(idx) {
		return this.path.get(idx);
	},

	/**
	 * Sets point stroke
	 *
	 * @method Module.Stroke.prototype.setPoint
	 * @param {int} idx
	 * @param {Module.Point2D} point stroke point
	 */
	setPoint: function(idx, point) {
		this.path.set(idx, point);
	},

	/**
	 * When stroke path is modified, bounds should be updated
	 *
	 * @method Module.Stroke.prototype.updateBounds
	 */
	updateBounds: function() {
		this.path.calculateBounds(this.width);
	},

	/**
	 * Split stroke
	 *
	 * @method Module.Stroke.prototype.split
	 * @param {Module.VectorInterval} intervals
	 * @param {Module.IntersectorTargetType} type
	 * @return {Module.Split} intersection result
	 */
	split: function(intervals, type) {
		var result;

		var dirtyArea;
		var intersect = false;

		var strokes = new Array();
		var holes = new Array();
		var selected = new Array();

		for (var i = 0; i < intervals.size(); i++) {
			var interval = intervals.get(i);
			var subStroke = this.subStroke(interval.fromIndex, interval.toIndex, interval.fromTValue, interval.toTValue);

			if (interval.inside) {
				intersect = true;
				dirtyArea = RectTools.union(dirtyArea, subStroke.bounds);
			}

			if (type == Module.IntersectorTargetType.STROKE) {
				if (interval.inside)
					holes.push(interval);
				else
					strokes.push(subStroke);
			}
			else {
				if (interval.inside)
					selected.push(subStroke);

				strokes.push(subStroke);
			}
		}

		result = {intersect: intersect, dirtyArea: dirtyArea};

		if (intersect) {
			result.strokes = strokes;

			if (type == Module.IntersectorTargetType.STROKE)
				result.holes = holes;
			else
				result.selected = selected;
		}

		return result;
	},

	/**
	 * Creates new stroke based on current
	 *
	 * @method Module.Stroke.prototype.subStroke
	 * @param {int} fromIndex start point idx
	 * @param {int} toIndex end point idx
	 * @param {float} fromTValue
	 * @param {float} toTValue
	 * @return {Module.Stroke} new stroke
	 */
	subStroke: function(fromIndex, toIndex, fromTValue, toTValue) {
		var path = this.path.getPart(fromIndex, toIndex);
		var stroke = new Module.Stroke(this.brush, path, this.width, this.color, fromTValue, toTValue);

		stroke.fromIndex = fromIndex;
		stroke.toIndex = toIndex;

		return stroke;
	},

	/**
	 * Transform stroke
	 *
	 * @method Module.Stroke.prototype.transform
	 * @param {Module.Mat4} mat matrix transform matrix
	 */
	transform: function(mat) {
		var sx = Math.sqrt(mat["m00"]*mat["m00"] + mat["m01"]*mat["m01"]);

		for (var i = 0; i < this.path.length; i++) {
			var pt = this.path.get(i);
			var tpt = Module.Mat4.transformPoint(pt, mat);

			pt.x = tpt.x;
			pt.y = tpt.y;
			pt.width *= sx;

			this.path.set(i, pt);
		}

		this.path.calculateBounds(this.width);
	},

	toJSON: function() {
		var stroke = {
			path: {
				points: this.path.points.toArray(),
				stride: this.path.stride
			},
			width: this.width,
			color: this.color,
			ts: this.ts,
			tf: this.tf,
			randomSeed: this.randomSeed,
			blendMode: this.blendMode.value
		};

		return stroke;
	}
});

/**
 * Stroke painter
 *
 * @class Module.StrokeRenderer
 * @since version 1.3
 * @param {Module.InkCanvas} canvas view layer
 * @param {Module.GenericLayer} [layer] buffer layer for stroke building. When not available is auto created.
 *  When not available preliminary curve draw is over canvas.
 */
Module.StrokeRenderer = function(canvas, layer) {
	this.canvas = canvas;
	this.layer = layer || canvas.createLayer();

	this.ownLayer = !layer;

	this.restart = true;
}

Object.extend(Module.StrokeRenderer.prototype, {
	/**
	 * Defines stroke background color, default is transperent
	 *
	 * @memberof Module.StrokeRenderer
	 * @member {Module.Color} backgroundColor
	 */
	backgroundColor: Module.color.TRANSPERENT,

	/**
	 * Defines rendering brush
	 *
	 * @memberof Module.StrokeRenderer
	 * @member {Module.StrokeBrush} brush
	 */
	brush: null,

	/**
	 * Defines rendering color
	 *
	 * @memberof Module.StrokeRenderer
	 * @member {Module.Color} color
	 */
	color: null,

	/**
	 * Defines stroke width. Default value is NaN.
	 * NaN value instructs 'Module.StrokeRenderer' that the path has a variable width
	 * which will be provided by the control points array.
	 *
	 * @memberof Module.StrokeRenderer
	 * @member {float} width
	 */
	width: NaN,

	/**
	 * Random generator seed, applicable only when brush is Module.ParticleBrush
	 *
	 * @memberof Module.StrokeRenderer
	 * @member {int} randomSeed
	 */
	randomSeed: 0,

	/**
	 * Used when blending updated area and stroke. Default is NORMAL.
	 *
	 * @memberof Module.StrokeRenderer
	 * @member {Module.BlendMode} blendMode
	 */
	blendMode: null,

	/**
	 * Buffer layer for stroke building with preliminary curve, default is null.
	 * Auto created when draw preliminary path.
	 *
	 * @memberof Module.StrokeRenderer
	 * @member {Module.Layer} preliminaryLayer
	 */
	preliminaryLayer: null,

	/**
	 * Current stroke area
	 *
	 * @memberof Module.StrokeRenderer
	 * @member {Module.Rectangle} strokeBounds
	 */
	strokeBounds: null,

	/**
	 * Current modified segments area
	 *
	 * @memberof Module.StrokeRenderer
	 * @member {Module.Rectangle} updatedArea
	 */
	updatedArea: null,

	/**
	 * Configures rendering. First call is used for initialilzation.
	 *
	 * @method Module.StrokeRenderer.prototype.configure
	 * @param {Module.ComposeStyle} settings renderer configuration settings
	 */
	configure: function(settings) {
		if (!this.blendMode) this.blendMode = Module.BlendMode.NORMAL;

		if (settings.brush) this.brush = settings.brush;
		if (typeof settings.width != "undefined") this.width = settings.width;
		if (settings.color) this.color = settings.color;
		if (settings.blendMode) this.blendMode = settings.blendMode;
		if (settings.backgroundColor) this.backgroundColor = settings.backgroundColor;

		if (this.brush instanceof Module.ParticleBrush && settings.randomSeed > 0)
			this.initialRandomSeed = settings.randomSeed;
	},

	/**
	 * Render data input
	 *
	 * @method Module.StrokeRenderer.prototype.draw
	 * @param {(Module.Path | Module.Stroke)} path
	 * @param {boolean} [endStroke] applicable only when path is Module.Path, when true caps end of stroke and completes stroke rendering
	 * @param {boolean} [endCap] applicable only when path is Module.Path, when true caps end of stroke, but do not completes stroke rendering
	 */
	draw: function(path, endStroke, endCap) {
		if (this.layer.isDeleted())
			throw new Error("StrokeRenderer cannot draw, it is already deleted");

		if (this.restart) {
			if (!this.brush) throw new Error("StrokeRenderer requires 'brush' to be configured");
			if (!this.color) throw new Error("StrokeRenderer requires 'color' to be configured");

			this.reset();
			this.restart = false;
		}

		if (path instanceof Module.Stroke) {
			var dirtyArea = this.layer.draw(path);

			this.strokeBounds = dirtyArea;
			this.updatedArea = dirtyArea;

			this.restart = true;
		}
		else {
			if (!this.validate(path)) return;

			if (this.beginStroke && this.brush instanceof Module.ParticleBrush && (path.stride == 4 || (path.stride == 3 && !isNaN(this.width))))
				this.color = {red: this.color.red, green: this.color.green, blue: this.color.blue, alpha: NaN};

			var drawContext = (this.brush instanceof Module.ParticleBrush)?this.strokeLastRendererdDrawContext:null;
			var dirtyArea = this.layer.drawStroke(this.brush, path, this.width, this.color, this.beginStroke, endStroke || endCap, 0, 1, drawContext);

			this.incompleteStrokeBounds = RectTools.union(this.incompleteStrokeBounds, dirtyArea);
			this.strokeBounds = RectTools.union(this.strokeBounds, dirtyArea);
			this.updatedArea = RectTools.union(this.incompleteStrokeBounds, this.preliminaryDirtyArea);

			this.blendWithPreliminaryLayer = false;
			this.beginStroke = false;

			if (endStroke) {
				this.strokeBounds = RectTools.ceil(this.strokeBounds);
				this.restart = true;
			}
		}
	},

	/**
	 * Render preliminary curve
	 *
	 * @method Module.StrokeRenderer.prototype.drawPreliminary
	 * @param {Module.Path} path
	 */
	drawPreliminary: function(path) {
		if (!this.validate(path)) return;

		var drawContext = null;
		var layer = null;

		if (this.brush instanceof Module.ParticleBrush) {
			this.strokeLastRendererdDrawContext.copyTo(this.strokePrelimLastRenderedDrawContext);
			drawContext = this.strokePrelimLastRenderedDrawContext;
		}

		if (this.ownLayer) {
			if (!this.preliminaryLayer) {
				this.preliminaryLayer = this.canvas.createLayer();
				this.preliminaryLayer.clear(this.backgroundColor);
			}

			layer = this.preliminaryLayer;
		}
		else
			layer = this.preliminaryLayer || this.canvas;

		if (this.updatedArea && this.preliminaryLayer)
			this.preliminaryLayer.blendWithRect(this.layer, this.updatedArea, Module.BlendMode.NONE);

		this.preliminaryDirtyArea = layer.drawStroke(this.brush, path, this.width, this.color, this.beginStroke, true, 0, 1, drawContext);

		if (this.preliminaryLayer) {
			this.blendWithPreliminaryLayer = true;
			this.updatedArea = RectTools.union(this.updatedArea, this.preliminaryDirtyArea);
		}
	},

	/**
	 * Reset current state
	 *
	 * @method Module.StrokeRenderer.prototype.abort
	 */
	abort: function() {
		this.restart = true;
	},

	reset: function() {
		this.beginStroke = true;

		this.incompleteStrokeBounds = null;
		this.strokeBounds = null;
		this.updatedArea = null;

		if (this.brush instanceof Module.ParticleBrush) {
			if (this.strokeLastRendererdDrawContext && !this.strokeLastRendererdDrawContext.isDeleted()) this.strokeLastRendererdDrawContext.delete();

			this.strokeLastRendererdDrawContext = new Module.StrokeDrawContext();
			if (!this.strokePrelimLastRenderedDrawContext) this.strokePrelimLastRenderedDrawContext = new Module.StrokeDrawContext();

			if (this.initialRandomSeed) {
				this.strokeLastRendererdDrawContext.seed = this.initialRandomSeed;
				delete this.initialRandomSeed;
			}

			this.randomSeed = this.strokeLastRendererdDrawContext.seed;
		}
		else
			this.randomSeed = 0;

		if (this.ownLayer) {
			this.layer.clear(this.backgroundColor);
			if (this.preliminaryLayer) this.preliminaryLayer.clear(this.backgroundColor);
		}
	},

	validate: function(path) {
		if (!Module.Stroke.validatePath(path))
			return false;

		if (isNaN(this.width) && path.stride == 2) {
			Module.printErr("WARNING: Either the width property must be set or the path points must include a witdh value!");
			return false;
		}

		return true;
	},

	/**
	 * Blends affected area with another layer
	 *
	 * @method Module.StrokeRenderer.prototype.blendUpdatedArea
	 * @param {Module.GenericLayer} [layer=this.canvas] target layer for stroke blending, where blendMode is previously configured
	 */
	blendUpdatedArea: function(layer) {
		if (!this.updatedArea) return;

		var target = layer || this.canvas;
		var updatedAreaLayer = this.blendWithPreliminaryLayer?this.preliminaryLayer:this.layer;
		var dirtyArea = RectTools.intersect(this.updatedArea, target.bounds);
		if (dirtyArea) target.blendWithRect(updatedAreaLayer, RectTools.ceil(dirtyArea), this.blendMode);

		this.incompleteStrokeBounds = null;
		this.updatedArea = null;
	},

	/**
	 * Blends completed stroke with another layer
	 *
	 * @method Module.StrokeRenderer.prototype.blendStroke
	 * @param {Module.GenericLayer} [layer=this.canvas] target layer for stroke blending
	 * @param {Module.BlendMode} [blendMode=this.blendMode] blending mode
	 */
	blendStroke: function(layer, blendMode) {
		if (!this.strokeBounds) return;

		var source = this.layer;
		var target = layer || this.canvas;

		var dirtyArea = RectTools.intersect(this.strokeBounds, target.bounds);
		if (dirtyArea) target.blendWithRect(source, RectTools.ceil(dirtyArea), blendMode || this.blendMode);
	},

	/**
	 * Converts current drawed path to stroke
	 *
	 * @method Module.StrokeRenderer.prototype.toStroke
	 * @param {Module.Path} path stroke path
	 * @return {Module.Stroke} stroke
	 */
	toStroke: function(path) {
		return new Module.Stroke(this.brush, path, this.width, this.color, 0, 1, this.randomSeed, this.blendMode);
	},

	delete: function() {
		if (this.ownLayer) {
			this.layer.delete();
			if (this.preliminaryLayer) this.preliminaryLayer.delete();
		}

		if (this.strokeLastRendererdDrawContext) this.strokeLastRendererdDrawContext.delete();
		if (this.strokePrelimLastRenderedDrawContext) this.strokePrelimLastRenderedDrawContext.delete();
	}
});

Module.WILLFormat = {
	version: new Uint8Array([1, 0, 0]),
	fourCCLength: 4,

	headers: {
		riffFourCC: "RIFF".toCharArray(true),
		formatFourCC: "WILL".toCharArray(true),
		headChunkFourCC: "HEAD".toCharArray(true),
		inkChunkFourCC: "INK ".toCharArray(true),
		paintChunkFourCC: "PNT ".toCharArray(true)
	}
};

/**
 * WILL format encoder
 *
 * @deprecated since 1.5
 * @class Module.WILLEncoder
 * @since version 1.3
 */
Module.WILLEncoder = function() {
	this.chunks = new Array();

	this.fileBytes = null;
	this.dataView = null;
	this.byteOffset = 0;

	Object.defineProperty(Module.WILLEncoder.prototype, "data", {
		get: function() {
			if (!this.fileBytes) this.build();
			return this.fileBytes;
		},
	});
}

Object.extend(Module.WILLEncoder.prototype, {
	/**
	 * Encoded data container
	 *
	 * @memberof Module.WILLEncoder
	 * @member {Uint8Array} data
	 */
	data: null,

	/**
	 * Encodes ink path
	 *
	 * @method Module.WILLEncoder.prototype.encodeInk
	 * @param {Uint8Array} ink bytes result from ink paths serialization
	 */
	encodeInk: function(ink) {
		if (!ink) return;
		this.encode(Module.WILLFormat.headers.inkChunkFourCC, ink);
	},

	encodePaint: function(paint) {
		if (!paint) return;
		this.encode(Module.WILLFormat.headers.paintChunkFourCC, paint);
	},

	/**
	 * Encodes data
	 *
	 * @method Module.WILLEncoder.prototype.encode
	 * @param {String} fourCC chunk identifier, should be 4 chars long, where allowed chars are latin leters, numbers and space
	 * @param {Uint8Array} bytes serialized user defined data
	 */
	encode: function(fourCC, bytes) {
		var fourCCBytes = (fourCC instanceof Uint8Array)?fourCC:fourCC.toCharArray().toUint8Array();

		if (fourCCBytes.length != Module.WILLFormat.fourCCLength)
			throw new Error("Invalid fourCC: \"" + fourCC + "\"");

		if (this.fileBytes)
			throw new Error("File content building completed. Cannot add more chunks.");

		this.chunks.push(this.createChunk(fourCCBytes, bytes));
	},

	build: function() {
		var ffh = Module.WILLFormat.headers;
		var chunksLength = 0;

		this.chunks.unshift(this.createChunk(Module.WILLFormat.headers.headChunkFourCC, Module.WILLFormat.version));

		this.chunks.forEach(function(chunk) {
			chunksLength += chunk.length;
		}, this);

		var riffFileSize = ffh.formatFourCC.length + chunksLength;
		var fileLength = ffh.riffFourCC.length + Uint32Array.BYTES_PER_ELEMENT + riffFileSize;

		var fileBuffer = new ArrayBuffer(fileLength);
		this.fileBytes = new Uint8Array(fileBuffer);
		this.dataView = new DataView(fileBuffer);

		this.fileBytes.set(ffh.riffFourCC, this.byteOffset);
		this.byteOffset += ffh.riffFourCC.length;

		this.dataView.setUint32(this.byteOffset, riffFileSize, true);
		this.byteOffset += Uint32Array.BYTES_PER_ELEMENT;

		this.fileBytes.set(ffh.formatFourCC, this.byteOffset);
		this.byteOffset += ffh.formatFourCC.length;

		this.chunks.forEach(function(chunk) {
			this.appendChunk(chunk);
			this.byteOffset += chunk.length;
		}, this);
	},

	createChunk: function(fourCC, bytes) {
		var size = bytes.length;
		var paddingSize = size % 2;
		var length = fourCC.length + Uint32Array.BYTES_PER_ELEMENT + size + paddingSize;

		return {
			fourCC: fourCC,
			bytes: bytes,
			size: size,
			length: length
		};
	},

	appendChunk: function(chunk) {
		this.fileBytes.set(chunk.fourCC, this.byteOffset);

		var byteOffset = this.byteOffset + chunk.fourCC.length;

		this.dataView.setUint32(byteOffset, chunk.size, true);
		byteOffset += Uint32Array.BYTES_PER_ELEMENT;

		this.fileBytes.set(chunk.bytes, byteOffset);
	}
});

/**
 * WILL format decoder
 *
 * @deprecated since 1.5
 * @class Module.WILLDecoder
 * @since version 1.3
 * @param {ArrayBuffer} fileBuffer file content
 */
Module.WILLDecoder = function(fileBuffer) {
	this.fileBytes = new Uint8Array(fileBuffer);
	this.dataView = new DataView(fileBuffer);

	this.byteOffset = 0;
}

Object.extend(Module.WILLDecoder.prototype, {
	/**
	 * File format version
	 *
	 * @memberof Module.WILLDecoder
	 * @member {String} file
	 */
	version: "",

	/**
	 * Serialized strokes data, could be decoded with Module.InkDecoder
	 *
	 * @memberof Module.WILLDecoder
	 * @member {Uint8Array} ink
	 */
	ink: null,

	paint: null,

	/**
	 * Serialized user defined data
	 *
	 * @memberof Module.WILLDecoder
	 * @member {Array<Object>} chunks
	 */
	chunks: new Array(),

	/**
	 * Decodes data. Decoded data is accessible in instance properties.
	 *
	 * @method Module.WILLDecoder.prototype.decode
	 */
	decode: function() {
		var ffh = Module.WILLFormat.headers;

		var byteOffsetLength = this.byteOffset + ffh.riffFourCC.length;
		if (String.fromCharArray(this.fileBytes.subarray(this.byteOffset, byteOffsetLength)) != String.fromCharArray(ffh.riffFourCC)) throw new Error("Invalid RIFF fourCC");

		this.byteOffset = byteOffsetLength;
		byteOffsetLength = this.byteOffset + Uint32Array.BYTES_PER_ELEMENT;
		var riffFileSize = this.dataView.getUint32(this.byteOffset, true) + byteOffsetLength;

		if (riffFileSize != this.fileBytes.length) throw new Error("Incomplete RIFF file");
		if (riffFileSize % 2 != 0) throw new Error("Invalid RIFF file size");

		this.byteOffset = byteOffsetLength;
		byteOffsetLength = this.byteOffset + ffh.formatFourCC.length;
		if (String.fromCharArray(this.fileBytes.subarray(this.byteOffset, byteOffsetLength)) != String.fromCharArray(ffh.formatFourCC)) throw new Error("Invalid WILL fourCC");

		this.byteOffset = byteOffsetLength;

		while (this.byteOffset < riffFileSize) {
			var chunk = this.extractChunk();
			this.byteOffset += chunk.length;

			var fourCC = String.fromCharArray(chunk.fourCC);

			switch(fourCC) {
				case String.fromCharArray(ffh.headChunkFourCC):
					this.version = chunk.bytes[0] + "." + chunk.bytes[1] + chunk.bytes[2];
					break;
				case String.fromCharArray(ffh.inkChunkFourCC):
					this.ink = chunk.bytes;
					break;
				case String.fromCharArray(ffh.paintChunkFourCC):
					this.paint = chunk.bytes;
					break;
				default:
					this.chunks.push({fourCC: fourCC, bytes: chunk.bytes});
			}
		}
	},

	extractChunk: function() {
		var fourCC = this.fileBytes.subarray(this.byteOffset, this.byteOffset + Module.WILLFormat.fourCCLength);
		var bytes = null;
		var size = 0;
		var length = 0;
		var paddingSize = 0;

		var byteOffsetLength = this.byteOffset + fourCC.length;
		var byteOffset = byteOffsetLength;
		byteOffsetLength = byteOffset + Uint32Array.BYTES_PER_ELEMENT;

		size = this.dataView.getUint32(byteOffset, true);

		byteOffset = byteOffsetLength;
		byteOffsetLength = byteOffset + size;

		if (size > 0) {
			bytes = this.fileBytes.subarray(byteOffset, byteOffsetLength);
			bytes = new Uint8Array(bytes, bytes.byteOffset, bytes.length);
		}
		else
			bytes = new Uint8Array(0);

		length = fourCC.length + Uint32Array.BYTES_PER_ELEMENT + size;
		paddingSize = length % 2;

		return {
			fourCC: fourCC,
			bytes: bytes,
			size: size,
			length: length + paddingSize
		};
	}
});

/**
 * @namespace RectTools
 * @description useful library which provides basic operations with rectangles
 */
var RectTools = {
	/**
	 * Creates a rect with the given dimensions
	 *
	 * @param {float} [left=NaN] x coordinate
	 * @param {float} [top=NaN] y coordinate
	 * @param {float} [width=NaN] rect width
	 * @param {float} [height=NaN] rect height
	 * @return {Module.Rectangle} rect
	 */
	create: function(left, top, width, height) {
		var rect = {
			left: isNaN(left)?NaN:left,
			top: isNaN(top)?NaN:top,
			width: isNaN(width)?NaN:width,
			height: isNaN(height)?NaN:height
		};

		rect.right = left + width;
		rect.bottom = top + height;

		return rect;
	},

	/**
	 * Ceils all properties of the rect object
	 *
	 * @param {Module.Rectangle} rect src rect
	 * @return {Module.Rectangle} ceiled rect
	 */
	ceil: function(rect) {
		if (!rect) return null;
		return this.create(Math.floor(rect.left), Math.floor(rect.top), Math.ceil(rect.width), Math.ceil(rect.height));
	},

	/**
	 * Combines 2 rects in 1 bigger
	 *
	 * @param {Module.Rectangle} rectA
	 * @param {Module.Rectangle} rectB
	 * @return {Module.Rectangle} unioned rect
	 */
	union: function(rectA, rectB) {
		if (!rectA || isNaN(rectA.left)) return rectB;
		if (!rectB || isNaN(rectB.left)) return rectA;

		var left = Math.min(rectA.left, rectB.left);
		var top = Math.min(rectA.top, rectB.top);
		var right = Math.max(rectA.right, rectB.right);
		var bottom = Math.max(rectA.bottom, rectB.bottom);

		return this.create(left, top, right-left, bottom-top);
	},

	/**
	 * Intersects 2 rects
	 *
	 * @param {Module.Rectangle} rectA
	 * @param {Module.Rectangle} rectB
	 * @return {Module.Rectangle} intersected rect, hhen intersection not available result is null
	 */
	intersect: function(rectA, rectB) {
		if (!rectA || isNaN(rectA.left) || !rectB || isNaN(rectB.left)) return null;

		if (rectA.left < rectB.right && rectA.right > rectB.left && rectA.bottom > rectB.top && rectA.top < rectB.bottom) {
			var left = Math.max(rectA.left, rectB.left);
			var top = Math.max(rectA.top, rectB.top);
			var right = Math.min(rectA.right, rectB.right);
			var bottom = Math.min(rectA.bottom, rectB.bottom);

			return this.create(left, top, right-left, bottom-top);
		}
		else
			return null;
	},

	getPath: function(rect) {
		return Module.PathBuilder.createPath([
			rect.left, rect.top,
			rect.left, rect.top,
			rect.right, rect.top,
			rect.right, rect.bottom,
			rect.left, rect.bottom,
			rect.left, rect.top,
			rect.left, rect.top,
		], 2);
	}
};

/**
 * @namespace GLTools
 * @description useful tools for working with textures
 */
var GLTools = {
	/**
	 * Used for interoperability between WebGL and WILL SDK. In order to use a WebGL resource with
	 * the WILL SDK that resource must have a valid identifier which is provided by this method.
	 * Upon successful creation of an identifier, the resource is added to a specific collection
	 * in the GL namespace (defined in WacomInkEngine.js) and is globally accessible from there.
	 *
	 * @param {(WebGLBuffer | WebGLRenderbuffer | WebGLFramebuffer | WebGLTexture | WebGLProgram | WebGLShader)} glResource
	 */
	indexGLResource: function(glResource) {
		var resources;

		if (glResource instanceof WebGLBuffer)
			resources = GL.buffers;
		else if (glResource instanceof WebGLRenderbuffer)
			resources = GL.renderbuffers;
		else if (glResource instanceof WebGLFramebuffer)
			resources = GL.framebuffers;
		else if (glResource instanceof WebGLTexture)
			resources = GL.textures;
		else if (glResource instanceof WebGLProgram)
			resources = GL.programs;
		else if (glResource instanceof WebGLShader)
			resources = GL.shaders;
		else
			throw new Error("Cannot index this GL resource");

		var id = GL.getNewId(resources);

		glResource.name = id;
		resources[id] = glResource;
	},

	/**
	 * Used for interoperability between WebGL and WILL SDK.
	 * Creates texture with predifined configuration.
	 *
	 * @param {int} [wrapMode=CLAMP_TO_EDGE] texture parameter for TEXTURE_WRAP_S and TEXTURE_WRAP_T
	 * @param {int} [sampleMode=NEAREST] texture parameter for TEXTURE_MIN_FILTER and TEXTURE_MAG_FILTER
	 */
	createTexture: function(wrapMode, sampleMode) {
		if (!wrapMode) wrapMode = GLctx.CLAMP_TO_EDGE;
		if (!sampleMode) sampleMode = GLctx.NEAREST;

		var texture = GLctx.createTexture();

		GLctx.bindTexture(GLctx.TEXTURE_2D, texture);
		GLctx.texParameteri(GLctx.TEXTURE_2D, GLctx.TEXTURE_WRAP_S, wrapMode);
		GLctx.texParameteri(GLctx.TEXTURE_2D, GLctx.TEXTURE_WRAP_T, wrapMode);
		GLctx.texParameteri(GLctx.TEXTURE_2D, GLctx.TEXTURE_MIN_FILTER, sampleMode);
		GLctx.texParameteri(GLctx.TEXTURE_2D, GLctx.TEXTURE_MAG_FILTER, sampleMode);
		GLctx.bindTexture(GLctx.TEXTURE_2D, null);

		GLTools.indexGLResource(texture);

		return texture;
	},

	/**
	 * Handler for texture when is ready
	 *
	 * @callback PrepareTextureCallback
	 * @param {WebGLTexture} texture
	 * @see GLTools.prepareTexture
	 */

	/**
	 * Fills a texture object with pixels
	 *
	 * @param {int} id identifier of an already created texture
	 * @param {(URI | Array<URI>)} srcORArray URI to an image that will be used as a pixel source or mipmap array
	 * @param {PrepareTextureCallback} [callback] function that will receive the prepared texture as a parameter, to process it
	 * @param {Object} [context] callback context
	 */
	prepareTexture: function(id, srcORArray, callback, context) {
		var texture = GL.textures[id];

		if (srcORArray instanceof Array) {
			var sources = srcORArray;
			var mipmap = new Array();
			var cnt = sources.length;

			sources.forEach(function(src) {
				var image = new Image();
				image.onload = function () {
					cnt--;

					if (cnt == 0) {
						GLTools.completeMipMap(mipmap, function() {
							texture.mipmap = mipmap;
							GLTools.initTexture(texture);
							if (callback) callback.call(context || {}, texture);
						});
					}
				}

				image.src = src;
				mipmap.push(image);
			}, this);
		}
		else {
			var src = srcORArray;

			var image = new Image();
			image.onload = function () {
				texture.image = this;
				GLTools.initTexture(texture);
				if (callback) callback.call(context || {}, texture);
			}

			image.src = src;
		}
	},

	completeMipMap: function(mipmap, callback) {
		var cnt = 0;

		if (mipmap.last.width == 1) {
			callback();
			return;
		}

		while (mipmap.last.width > 1) {
			cnt++;

			var canvas = document.createElement("canvas");
			canvas.width = mipmap.last.width / 2;
			canvas.height = mipmap.last.height / 2;

			canvas.getContext("2d").drawImage(mipmap.last, 0, 0, canvas.width, canvas.height);

			var image = new Image(canvas.width, canvas.height);
			image.onload = function () {
				cnt--;
				if (cnt == 0) callback();
			};

			image.src = canvas.toDataURL();
			mipmap.push(image);
		}
/*
		var last = mipmap.last;

		while (last.width > 1) {
			cnt++;

			last.width /= 2;
			last.height /= 2;

			var image = new Image();
			image.onload = function () {
				cnt--;
				if (cnt == 0) callback();
			};

			image.src = last.toDataURL();
			mipmap.push(image);
		}

		last.removeAttribute("width");
		last.removeAttribute("height");
*/
	},

	initTexture: function(texture) {
		GLctx.bindTexture(GLctx.TEXTURE_2D, texture);
		GLctx.pixelStorei(GLctx.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);

		if (texture.mipmap) {
			for (var i = 0; i < texture.mipmap.length; i++)
				GLctx.texImage2D(GLctx.TEXTURE_2D, i, GLctx.RGBA, GLctx.RGBA, GLctx.UNSIGNED_BYTE, texture.mipmap[i]);

			GLctx.texParameteri(GLctx.TEXTURE_2D, GLctx.TEXTURE_MIN_FILTER, GLctx.LINEAR_MIPMAP_LINEAR);
			GLctx.texParameteri(GLctx.TEXTURE_2D, GLctx.TEXTURE_MAG_FILTER, GLctx.LINEAR);
		}
		else
			GLctx.texImage2D(GLctx.TEXTURE_2D, 0, GLctx.RGBA, GLctx.RGBA, GLctx.UNSIGNED_BYTE, texture.image);

		GLctx.pixelStorei(GLctx.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
		GLctx.bindTexture(GLctx.TEXTURE_2D, null);

		this.logGLError(texture.name);
	},

	/**
	 * Reads pixel data from texture
	 *
	 * @param {WebGLTexture} texture
	 * @param {Module.Rectangle} rect specific rect in texture
	 * @return {Uint8Array} pixels
	 */
	readTexturePixels: function(texture, rect) {
		var data = new Uint8Array(rect.width * rect.height * 4);

		// Create a framebuffer backed by the texture
		var framebuffer = GLctx.createFramebuffer();
		GLctx.bindFramebuffer(GLctx.FRAMEBUFFER, framebuffer);
		GLctx.framebufferTexture2D(GLctx.FRAMEBUFFER, GLctx.COLOR_ATTACHMENT0, GLctx.TEXTURE_2D, texture, 0);

		// Read the contents of the framebuffer
		GLctx.readPixels(rect.left, rect.top, rect.width, rect.height, GLctx.RGBA, GLctx.UNSIGNED_BYTE, data);

		GLctx.deleteFramebuffer(framebuffer);
		return data;
	},

	/**
	 * Used for debugging
	 *
	 * @param {String} message could be texture id or another usefull information
	 */
	logGLError: function(message) {
		var error = GLctx.getError();
		if (error > 0) console.error("WebGL error - " + message + ": " + error);
	}
};