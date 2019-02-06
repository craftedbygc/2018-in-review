varying vec2 vUv;

uniform float time;
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;
uniform sampler2D video;
uniform float opacity;
uniform vec3 gradientColor;
uniform float progress;

void main() {

	vec2 uv = vUv;
	// vec4 color = texture2D( video, vUv );

	vec4 origColor = texture2D(video, vUv);
    float grayscaleValue = dot(origColor.rgb, vec3(0.299, 0.587, 0.114));

	gl_FragColor = mix( mix(vec4( gradientColor, 1.0), vec4(1.0, 1.0, 1.0, 1.0), grayscaleValue), origColor, progress ) * opacity;


	#ifdef USE_FOG
		#ifdef USE_LOGDEPTHBUF_EXT
			float depth = gl_FragDepthEXT / gl_FragCoord.w;
		#else
			float depth = gl_FragCoord.z / gl_FragCoord.w;
		#endif
		float fogFactor = smoothstep( fogNear, fogFar, depth );
		gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
	#endif

}