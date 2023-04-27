'use strict';

var vertexShaderBlit = 
    `attribute vec4 position;
    varying vec2 texcoord;
    void main() {
    texcoord = position.xy * 0.5 + 0.5;
    gl_Position = position;
    }`;

var fragmentShaderBlit = 
    `#ifdef GL_FRAGMENT_PRECISION_HIGH
        precision highp int;
        precision highp float;
    #else
        precision mediump int;
        precision mediump float;
    #endif
    uniform sampler2D source;
    varying vec2 texcoord;`;

var HeatmapTexture = require('./heatmap-texture');
var HeatmapHeights = require('./heatmap-heights');
var HeatmapShader = require('./heatmap-shader');

function WebGLHeatmap(_arg) {
  var alphaEnd, alphaRange, alphaStart, error, getColorFun, gradientTexture, image, intensityToAlpha, output, quad, textureGradient, _ref, _ref1;
  _ref = _arg != null ? _arg : {}, this.canvas = _ref.canvas, this.width = _ref.width, this.height = _ref.height, intensityToAlpha = _ref.intensityToAlpha, gradientTexture = _ref.gradientTexture, alphaRange = _ref.alphaRange;
  if (!this.canvas) {
    this.canvas = document.createElement('canvas');
  }
  try {
    this.gl = this.canvas.getContext('experimental-webgl', {
      depth: false,
      antialias: false
    });
    if (this.gl === null) {
      this.gl = this.canvas.getContext('webgl', {
        depth: false,
        antialias: false
      });
      if (this.gl === null) {
        throw 'WebGL not supported';
      }
    }
  } catch (_error) {
    error = _error;
    throw 'WebGL not supported';
  }
  if (window.WebGLDebugUtils != null) {
    console.log('debugging mode');
    this.gl = WebGLDebugUtils.makeDebugContext(this.gl, function(err, funcName, args) {
      throw WebGLDebugUtils.glEnumToString(err) + " was caused by call to: " + funcName;
    });
  }
  this.gl.enableVertexAttribArray(0);
  this.gl.blendFunc(this.gl.ONE, this.gl.ONE);
  if (gradientTexture) {
    textureGradient = this.gradientTexture = new HeatmapTexture(this.gl, {
      channels: 'rgba'
    }).bind(0).setSize(2, 2).nearest().clampToEdge();
    if (typeof gradientTexture === 'string') {
      image = new window.Image();
      image.onload = function() {
        return textureGradient.bind().upload(image);
      };
      image.src = gradientTexture;
    } else {
      if (gradientTexture.width > 0 && gradientTexture.height > 0) {
        textureGradient.upload(gradientTexture);
      } else {
        gradientTexture.onload = function() {
          return textureGradient.upload(gradientTexture);
        };
      }
    }
    getColorFun = 'uniform sampler2D gradientTexture;\nvec3 getColor(float intensity){\n    return texture2D(gradientTexture, vec2(intensity, 0.0)).rgb;\n}';
  } else {
    textureGradient = null;
    getColorFun = 'vec3 getColor(float intensity){\n    vec3 blue = vec3(0.0, 0.0, 1.0);\n    vec3 cyan = vec3(0.0, 1.0, 1.0);\n    vec3 green = vec3(0.0, 1.0, 0.0);\n    vec3 yellow = vec3(1.0, 1.0, 0.0);\n    vec3 red = vec3(1.0, 0.0, 0.0);\n\n    vec3 color = (\n        fade(-0.25, 0.25, intensity)*blue +\n        fade(0.0, 0.5, intensity)*cyan +\n        fade(0.25, 0.75, intensity)*green +\n        fade(0.5, 1.0, intensity)*yellow +\n        smoothstep(0.75, 1.0, intensity)*red\n    );\n    return color;\n}';
  }
  if (intensityToAlpha == null) {
    intensityToAlpha = true;
  }
  if (intensityToAlpha) {
    _ref1 = alphaRange != null ? alphaRange : [0, 1], alphaStart = _ref1[0], alphaEnd = _ref1[1];
    output = "vec4 alphaFun(vec3 color, float intensity){\n    float alpha = smoothstep(" + (alphaStart.toFixed(8)) + ", " + (alphaEnd.toFixed(8)) + ", intensity);\n    return vec4(color*alpha, alpha);\n}";
  } else {
    output = 'vec4 alphaFun(vec3 color, float intensity){\n    return vec4(color, 1.0);\n}';
  }
  this.shader = new HeatmapShader(this.gl, {
    vertex: vertexShaderBlit,
    fragment: fragmentShaderBlit + ("float linstep(float low, float high, float value){\n    return clamp((value-low)/(high-low), 0.0, 1.0);\n}\n\nfloat fade(float low, float high, float value){\n    float mid = (low+high)*0.5;\n    float range = (high-low)*0.5;\n    float x = 1.0 - clamp(abs(mid-value)/range, 0.0, 1.0);\n    return smoothstep(0.0, 1.0, x);\n}\n\n" + getColorFun + "\n" + output + "\n\nvoid main(){\n    float intensity = smoothstep(0.0, 1.0, texture2D(source, texcoord).r);\n    vec3 color = getColor(intensity);\n    gl_FragColor = alphaFun(color, intensity);\n}")
  });
  if (this.width == null) {
    this.width = this.canvas.offsetWidth || 2;
  }
  if (this.height == null) {
    this.height = this.canvas.offsetHeight || 2;
  }
  this.canvas.width = this.width;
  this.canvas.height = this.height;
  this.gl.viewport(0, 0, this.width, this.height);
  this.quad = this.gl.createBuffer();
  this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quad);
  quad = new Float32Array([-1, -1, 0, 1, 1, -1, 0, 1, -1, 1, 0, 1, -1, 1, 0, 1, 1, -1, 0, 1, 1, 1, 0, 1]);
  this.gl.bufferData(this.gl.ARRAY_BUFFER, quad, this.gl.STATIC_DRAW);
  this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
  this.heights = new HeatmapHeights(this, this.gl, this.width, this.height);
}

WebGLHeatmap.prototype.adjustSize = function() {
  var canvasHeight, canvasWidth;
  canvasWidth = this.canvas.offsetWidth || 2;
  canvasHeight = this.canvas.offsetHeight || 2;
  if (this.width !== canvasWidth || this.height !== canvasHeight) {
    this.gl.viewport(0, 0, canvasWidth, canvasHeight);
    this.canvas.width = canvasWidth;
    this.canvas.height = canvasHeight;
    this.width = canvasWidth;
    this.height = canvasHeight;
    return this.heights.resize(this.width, this.height);
  }
};

WebGLHeatmap.prototype.display = function() {
  this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quad);
  this.gl.vertexAttribPointer(0, 4, this.gl.FLOAT, false, 0, 0);
  this.heights.nodeFront.bind(0);
  if (this.gradientTexture) {
    this.gradientTexture.bind(1);
  }
  this.shader.use().int('source', 0).int('gradientTexture', 1);
  return this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
};

WebGLHeatmap.prototype.update = function() {
  return this.heights.update();
};

WebGLHeatmap.prototype.clear = function() {
  return this.heights.clear();
};

WebGLHeatmap.prototype.clamp = function(min, max) {
  if (min == null) {
    min = 0;
  }
  if (max == null) {
    max = 1;
  }
  return this.heights.clamp(min, max);
};

WebGLHeatmap.prototype.multiply = function(value) {
  if (value == null) {
    value = 0.95;
  }
  return this.heights.multiply(value);
};

WebGLHeatmap.prototype.blur = function() {
  return this.heights.blur();
};

WebGLHeatmap.prototype.addPoint = function(x, y, size, intensity) {
  return this.heights.addPoint(x, y, size, intensity);
};

WebGLHeatmap.prototype.addPoints = function(items) {
  var item, _i, _len, _results;
  _results = [];
  for (_i = 0, _len = items.length; _i < _len; _i++) {
    item = items[_i];
    _results.push(this.addPoint(item.x, item.y, item.size, item.intensity));
  }
  return _results;
};

module.exports = WebGLHeatmap;
