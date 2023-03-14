'use strict';

var HeatmapTexture = require('./heatmap-texture');
var Framebuffer = require('./framebuffer');

function HeatmapNode(gl, width, height) {
  var floatExt;
  this.gl = gl;
  this.width = width;
  this.height = height;
  floatExt = this.gl.getFloatExtension({
    require: ['renderable']
  });
  this.texture = new HeatmapTexture(this.gl, {
    type: floatExt.type
  }).bind(0).setSize(this.width, this.height).nearest().clampToEdge();
  this.fbo = new Framebuffer(this.gl).bind().color(this.texture).unbind();
}

HeatmapNode.prototype.use = function() {
  return this.fbo.bind();
};

HeatmapNode.prototype.bind = function(unit) {
  return this.texture.bind(unit);
};

HeatmapNode.prototype.end = function() {
  return this.fbo.unbind();
};

HeatmapNode.prototype.resize = function(width, height) {
  this.width = width;
  this.height = height;
  return this.texture.bind(0).setSize(this.width, this.height);
};

module.exports = HeatmapNode;
