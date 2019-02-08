varying vec2 vUv;

uniform float time;
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;
uniform sampler2D texture;

void main() {

	vec2 uv = vUv;
	// vec4 color = texture2D( texture, vUv );

	vec4 origColor = texture2D(texture, vUv);

	// remove green
	if ( origColor.r < 0.4 && origColor.b < 0.4 && origColor.g > 0.4 ) {
		origColor.a = 0.;
	}

	if ( origColor.r < 0.9 && origColor.b < 0.9 && origColor.g > 0.9 ) {
		origColor.a = 0.;
	}

	// vec4 gradientImage = mix(vec4( gradientColor, 1.0), vec4(1.0, 1.0, 1.0, 1.0), grayscaleValue);

	// if ( gradientImage.b < 0.9 ) discard;

	// gl_FragColor = origColor * opacity;
	gl_FragColor = origColor;

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