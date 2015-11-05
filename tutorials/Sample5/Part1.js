var WILL = {
	backgroundColor: Module.color.from(190, 143, 1),

	init: function(width, height) {
		this.initInkEngine(width, height);
	},

	initInkEngine: function(width, height) {
		this.canvas = new Module.InkCanvas(width, height);
		this.canvas.clear(this.backgroundColor);

		this.initImageLayer();
	},

	initImageLayer: function() {
		var url = location.toString();
		url = url.substring(0, url.lastIndexOf("/")) + "/image.png";

		this.imageLayer = this.canvas.createLayerWithDimension(750, 600);

		GLTools.prepareTexture(
			this.imageLayer.textureID,
			url,
			function(texture) {
				this.canvas.blendWithMode(this.imageLayer, Module.BlendMode.NONE);
			},
			this
		);
	}
};

Module.addPostScript(function() {
	WILL.init(1600, 600);
});