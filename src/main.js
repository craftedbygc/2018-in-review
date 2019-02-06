import * as THREE from 'three'
import { TweenMax } from 'gsap'

import vert from './shaders/shader.vert'
import frag from './shaders/shader.frag'

// Initial HMR Setup
if (module.hot) {
    module.hot.accept()

    module.hot.dispose(() => {
        window.assets = grid.assets
        grid.renderer.domElement.removeEventListener('wheel', grid.scroll)
        document.querySelector('canvas').remove()
        grid.renderer.forceContextLoss()
        grid.renderer.context = null
        grid.renderer.domElement = null
        grid.renderer = null
        cancelAnimationFrame(grid.animationId)
        removeEventListener('resize', grid.resize)
        removeEventListener('mousemove', grid.mouseMove)
        removeEventListener('touchmove', grid.mouseMove)
        removeEventListener('mousedown', grid.mouseDown)
        removeEventListener('touchdown', grid.mouseDown)
    })
}

class PerspectiveGrid {

    constructor() {

        this.setConfig()

        if( !window.assets ) {
            this.loadAssets()
        } else {
            this.assets = window.assets
            this.init()
        }
        

    }

    setConfig() {

        this.c = {
            dpr: window.devicePixelRatio >= 2 ? 2 : 1,
            startTime: Date.now(),
            size: {
                w: window.innerWidth,
                h: window.innerHeight
            }
        }

        this.colourChanged = false;

    }

    loadAssets() {

        this.assets = {
            textures: {},
            fonts: {}
        }
        let assetLoadPromises = [];

        // Load Videos
        let videoEls = document.querySelectorAll( 'video' )

        for( let i = 0; i < videoEls.length; i++ ) {

            assetLoadPromises.push( new Promise( resolve => {

                videoEls[i].oncanplaythrough = () => {

                    let videoTex = new THREE.VideoTexture( videoEls[i] )
                    videoTex.minFilter = videoTex.magFilter = THREE.LinearFilter
                    videoTex.name = videoEls[i].id

                    resolve( videoTex )

                    videoEls[i].oncanplaythrough = null

                }

            }))

        }

        // Load images
        let imageLoader = new THREE.TextureLoader()
        imageLoader.crossOrigin = ''

        let images = {
            january: [
                'nala.jpg',
                'nala2.jpg',
                'skincare.jpg'
            ],
            february: [
                'iat.jpg',
                'jekka.jpg'
            ],
            march: [
                'nath.jpg',
                'sign.jpg'
            ]
        }

        for( let month in images ) {
            images[month].forEach( filename => {

                assetLoadPromises.push( new Promise( resolve => {

                    imageLoader.load( `assets/${month}/${filename}`, texture => {

                        texture.name = filename
                        // texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy()
                        resolve( texture )

                    })

                }))

            })
        }

        // Load Fonts
        let fontLoader = new THREE.FontLoader()
        let fonts = [
            'fonts/schnyder.json'
        ]

        for( let i = 0; i < fonts.length; i++ ) {
            assetLoadPromises.push( new Promise( resolve => fontLoader.load( fonts[i], font => resolve( font ) ) ) )
        }

        Promise.all( assetLoadPromises ).then( assets => {

            // all assets loaded - initialise
            assets.forEach( asset => {

                if( asset.image ) {
                    this.assets.textures[ asset.name ] = asset
                } else {
                    this.assets.fonts[ asset.data.familyName ] = asset
                }

            })

            console.log(this.assets);
            

            this.init()

        })

    }

    init() {

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
        // this.renderer.setPixelRatio( this.c.dpr )
        this.renderer.setSize( this.c.size.w, this.c.size.h )
        document.body.appendChild( this.renderer.domElement )

        this.scene = new THREE.Scene()
        this.scene.background = new THREE.Color( 0xAEC7C3 )
        this.scene.fog = new THREE.Fog( 0xAEC7C3, 1400, 2000)

        let cameraPosition = 900;

        const fov = 180 * ( 2 * Math.atan( this.c.size.h / 2 / cameraPosition ) ) / Math.PI
        this.camera = new THREE.PerspectiveCamera( fov, this.c.size.w / this.c.size.h, 1, 2000 )
        this.camera.lookAt( this.scene.position )
        this.camera.position.z = cameraPosition

        this.raycaster = new THREE.Raycaster()
        this.mouse = new THREE.Vector2()

        this.grid = new THREE.Group()
        this.scene.add( this.grid )
            
        this.textGeom = new THREE.TextGeometry( 'JANUARY', {
            font: this.assets.fonts['Schnyder L'],
            size: 200,
            height: 0,
            curveSegments: 20
        } )

        this.textGeom.center()

        this.textMat = new THREE.MeshPhongMaterial( { color: 0x1b42d8, emissive: 0x1b42d8 } )

        this.text = new THREE.Mesh( this.textGeom, this.textMat )
        this.text.position.set( -5, 0 , -550 )

        this.grid.add( this.text )

        this.textGeom2 = new THREE.TextGeometry( 'FEBRUARY', {
            font: this.assets.fonts['Schnyder L'],
            size: 200,
            height: 0,
            curveSegments: 20
        } )

        this.textGeom2.center()

        this.text2 = new THREE.Mesh( this.textGeom2, this.textMat )
        this.text2.position.set( 140, 0 , -2850 )

        this.grid.add( this.text2 )

        this.items = []

        let i = 0;

        for( let id in this.assets.textures ) {

            this.items[id] = {}

            this.items[id].uniforms = {
                time: { type: 'f', value: 1.0 },
                fogColor: { type: "c", value: this.scene.fog.color },
                fogNear: { type: "f", value: this.scene.fog.near },
                fogFar: { type: "f", value: this.scene.fog.far },
                texture: { type: 't', value: this.assets.textures[ id ] },
                opacity: { type: 'f', value: 1.0 },
                progress: { type: 'f', value: 0.0 },
                gradientColor: { type: 'vec3', value: new THREE.Color(0x1b42d8) }
            }

            this.items[id].geometry = new THREE.PlaneGeometry( 1, 1 )
            this.items[id].material = new THREE.ShaderMaterial({
                uniforms: this.items[id].uniforms,
                fragmentShader: frag,
                vertexShader: vert,
                fog: true,
                transparent: true
            })

            this.items[id].mesh = new THREE.Mesh( this.items[id].geometry, this.items[id].material )
            this.items[id].mesh.scale.set( 400, 300, 1 )

            let align = i % 4, pos = new THREE.Vector2()

            if( align === 0 ) pos.set( -350, 350 ) // bottom left
            if( align === 1 ) pos.set( 350, 350 ) // bottom right
            if( align === 2 ) pos.set( 350, -350 ) // top right
            if( align === 3 ) pos.set( -350, -350 ) // top left

            this.items[id].mesh.position.set( pos.x, pos.y, i * -300 )
            this.items[id].origPos = new THREE.Vector2( pos.x, pos.y )

            this.items[id].mesh.callback = () => {

                if( this.items[id].active ) {

                    TweenMax.to( this.items[id].mesh.position, 1.5, {
                        x: this.items[id].origPos.x,
                        y: this.items[id].origPos.y,
                        ease: 'Expo.easeInOut'
                    })

                    TweenMax.to( this.grid.position, 1.5, {
                        z: this.origGridPos,
                        ease: 'Expo.easeInOut'
                    })

                    TweenMax.to( this.items[id].uniforms.progress, 1.5, {
                        value: 0,
                        ease: 'Expo.easeInOut'
                    })

                    for( let id in this.items ) {
    
                        if( item === this.items[id] ) return
    
                        TweenMax.to( item.material.uniforms.opacity, 1.5, {
                            value: 1,
                            ease: 'Expo.easeInOut'
                        })
    
                    }

                    this.items[id].active = false

                } else {

                    this.items[id].active = true
                    this.origGridPos = this.grid.position.z

                    TweenMax.to( this.items[id].mesh.position, 1.5, {
                        x: 0,
                        y: 0,
                        ease: 'Expo.easeInOut'
                    })

                    TweenMax.to( this.items[id].uniforms.progress, 1.5, {
                        value: 1,
                        ease: 'Expo.easeInOut'
                    })
    
                    TweenMax.to( this.grid.position, 1.5, {
                        z: -this.items[id].mesh.position.z + 200,
                        ease: 'Expo.easeInOut'
                    })
    
                    for( let id in this.items ) {
    
                        if( item === this.items[id] ) return
    
                        TweenMax.to( item.material.uniforms.opacity, 1.5, {
                            value: 0,
                            ease: 'Expo.easeInOut'
                        })
    
                    }

                }

            }

            this.grid.add( this.items[id].mesh )

            i++

        }

        this.animate()
        this.initListeners()

    }

    scroll( e ) {

        TweenMax.set( this.grid.position, {
            z: '+=' + e.deltaY,
            ease: 'Power4.easeOut'
        })

    }

    mouseDown( e ) {

        e.preventDefault();

        this.mouse.x = ( e.clientX / this.renderer.domElement.clientWidth ) * 2 - 1;
        this.mouse.y = - ( e.clientY / this.renderer.domElement.clientHeight ) * 2 + 1;

        this.raycaster.setFromCamera( this.mouse, this.camera );

        let intersects = this.raycaster.intersectObjects( this.grid.children ); 

        if ( intersects.length > 0 ) {

            intersects[0].object.callback();

        }

    }

    mouseMove( e ) {

        this.mouse.x = e.clientX / window.innerWidth - 0.5
        this.mouse.y = e.clientY / window.innerHeight - 0.5
        this.updatingPerspective = true

    }

    updatePerspective() {

        TweenMax.to( this.camera.rotation, 3, {
            x: -this.mouse.y * 0.5,
            y: -this.mouse.x * 0.5,
            ease: 'Power4.easeOut',
        })

        this.updatingPerspective = false

    }

    animate() {

        this.animationId = requestAnimationFrame( this.animate.bind(this) )

        // let elapsedMilliseconds = Date.now() - this.c.startTime
        // this.items[0].uniforms.time.value = elapsedMilliseconds / 1000

        if( this.updatingPerspective ) {
            this.updatePerspective()
            this.updatingPerspective = false
        }

        if( this.grid.position.z > 1300 && !this.colourChanged ) {

            this.colourChanged = true

            let targetColor = new THREE.Color( 0x012534 )
            let targetColor2 = new THREE.Color( 0xFD6F53 )

            TweenMax.to( this.scene.fog.color, 3, {
                r: targetColor.r,
                g: targetColor.g,
                b: targetColor.b,
                ease: 'Expo.easeInOut'
            })

            TweenMax.to( this.scene.background, 3, {
                r: targetColor.r,
                g: targetColor.g,
                b: targetColor.b,
                ease: 'Expo.easeInOut'
            })

            TweenMax.to( [ this.textMat.color, this.textMat.emissive ], 3, {
                r: targetColor2.r,
                g: targetColor2.g,
                b: targetColor2.b,
                ease: 'Expo.easeInOut'
            })

            for( let id in this.items ) {

                TweenMax.to( this.items[id].uniforms.gradientColor.value, 3, {
                    r: targetColor.r,
                    g: targetColor.g,
                    b: targetColor.b,
                    ease: 'Expo.easeInOut'
                })

            }

        }

        this.renderer.render(this.scene, this.camera)

    }

    resize() {

        this.c.size = {
            w: window.innerWidth,
            h: window.innerHeight
        }
        this.camera.fov = 180 * ( 2 * Math.atan( this.c.size.h / 2 / this.camera.position.z ) ) / Math.PI
        this.camera.aspect = this.c.size.w / this.c.size.h
        this.camera.updateProjectionMatrix()
        this.renderer.setSize( this.c.size.w, this.c.size.h )

    }

    initListeners() {

        this.resize = this.resize.bind( this )
        this.mouseMove = this.mouseMove.bind( this )
        this.scroll = this.scroll.bind( this )
        this.mouseDown = this.mouseDown.bind( this )
        addEventListener( 'resize', this.resize )
        addEventListener( 'mousemove', this.mouseMove )
        addEventListener( 'touchmove', this.mouseMove )
        addEventListener( 'mousedown', this.mouseDown )
        // addEventListener( 'touchdown', this.mouseDown )
        this.renderer.domElement.addEventListener( 'wheel', this.scroll )

    }

}

const grid = new PerspectiveGrid()
window.grid = grid