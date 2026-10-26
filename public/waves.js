// placeholder – replaced by the recreated silk-waves shader
window.createWaves = function (canvas) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
  if (!gl) return null;
  return {
    render(t) { gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0.08, 0.09, 0.12 + 0.02 * Math.sin(t * Math.PI / 5), 1); gl.clear(gl.COLOR_BUFFER_BIT); },
    resize(w, h, dpr) { canvas.width = Math.round(w * dpr * 0.75); canvas.height = Math.round(h * dpr * 0.75); },
    destroy() {}
  };
};
