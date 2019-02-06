import * as THREE from 'three'
import OrbitControls from 'orbit-controls-es6'
import { TweenMax } from 'gsap'

import vert from './shaders/shader.vert'
import frag from './shaders/shader.frag'

// Initial HMR Setup
if (module.hot) {
    module.hot.accept()

    module.hot.dispose(() => {
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
        this.init()

        this.resize = this.resize.bind( this )
        this.mouseMove = this.mouseMove.bind( this )
        this.scroll = this.scroll.bind( this )
        this.mouseDown = this.mouseDown.bind( this )
        addEventListener( 'resize', this.resize )
        addEventListener( 'mousemove', this.mouseMove )
        addEventListener( 'touchmove', this.mouseMove )
        addEventListener( 'mousedown', this.mouseDown )
        addEventListener( 'touchdown', this.mouseDown )
        this.renderer.domElement.addEventListener( 'wheel', this.scroll )

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

    init() {

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
        // this.renderer.setPixelRatio( this.c.dpr )
        // this.renderer.setClearColor( 0xAEC7C3, 1 )
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

        // this.controls = new OrbitControls( this.camera )
        // this.controls.enableZoom = false

        this.raycaster = new THREE.Raycaster()
        this.mouse = new THREE.Vector2()

        this.grid = new THREE.Group()
        this.scene.add( this.grid )

        let loader = new THREE.FontLoader()

        loader.load( 'fonts/schnyder2.json', font => {
            
            this.font = font;

            this.textGeom = new THREE.TextGeometry( 'January', {
                font: this.font,
                size: 200,
                height: 0,
                curveSegments: 20
            } )

            this.textGeom.center()

            this.textMat = new THREE.MeshPhongMaterial( { color: 0x1b42d8, emissive: 0x1b42d8 } )

            this.text = new THREE.Mesh( this.textGeom, this.textMat )
            this.text.position.set( -5, 0 , -550 )

            this.grid.add( this.text )

            this.textGeom2 = new THREE.TextGeometry( 'February', {
                font: this.font,
                size: 200,
                height: 0,
                curveSegments: 20
            } )

            this.textGeom2.center()

            this.text2 = new THREE.Mesh( this.textGeom2, this.textMat )
            this.text2.position.set( 140, 0 , -2850 )

            this.grid.add( this.text2 )

            this.items = []

            let x = 0

            for( let i = 0; i < 300; i++ ) {

                this.items[i] = {}

                this.items[i].video = new THREE.VideoTexture( document.getElementById( 'vid' + x ) )
                this.items[i].video.minFilter = this.items[i].video.magFilter = THREE.LinearFilter        

                this.items[i].uniforms = {
                    time: { type: 'f', value: 1.0 },
                    fogColor: { type: "c", value: this.scene.fog.color },
                    fogNear: { type: "f", value: this.scene.fog.near },
                    fogFar: { type: "f", value: this.scene.fog.far },
                    video: { type: 't', value: this.items[i].video },
                    opacity: { type: 'f', value: 1.0 },
                    progress: { type: 'f', value: 0.0 },
                    gradientColor: { type: 'vec3', value: new THREE.Color(0x1b42d8) }
                }

                this.items[i].geometry = new THREE.PlaneGeometry( 1, 1 )
                this.items[i].material = new THREE.ShaderMaterial({
                    uniforms: this.items[i].uniforms,
                    fragmentShader: frag,
                    vertexShader: vert,
                    fog: true,
                    transparent: true
                })

                this.items[i].mesh = new THREE.Mesh( this.items[i].geometry, this.items[i].material )
                this.items[i].mesh.scale.set( 400, 300, 1 )

                let align = i % 4, pos = new THREE.Vector2()

                if( align === 0 ) pos.set( -350, 350 ) // bottom left
                if( align === 1 ) pos.set( 350, 350 ) // bottom right
                if( align === 2 ) pos.set( 350, -350 ) // top right
                if( align === 3 ) pos.set( -350, -350 ) // top left

                this.items[i].mesh.position.set( pos.x, pos.y, i * -300 )
                this.items[i].origPos = new THREE.Vector2( pos.x, pos.y )

                this.items[i].mesh.callback = () => {

                    if( this.items[i].active ) {

                        TweenMax.to( this.items[i].mesh.position, 1.5, {
                            x: this.items[i].origPos.x,
                            y: this.items[i].origPos.y,
                            ease: 'Expo.easeInOut'
                        })

                        TweenMax.to( this.grid.position, 1.5, {
                            z: this.origGridPos,
                            ease: 'Expo.easeInOut'
                        })

                        TweenMax.to( this.items[i].uniforms.progress, 1.5, {
                            value: 0,
                            ease: 'Expo.easeInOut'
                        })

                        this.items.forEach( item => {
        
                            if( item === this.items[i] ) return
        
                            TweenMax.to( item.material.uniforms.opacity, 1.5, {
                                value: 1,
                                ease: 'Expo.easeInOut'
                            })
        
                        })

                        this.items[i].active = false

                    } else {

                        this.items[i].active = true
                        this.origGridPos = this.grid.position.z

                        TweenMax.to( this.items[i].mesh.position, 1.5, {
                            x: 0,
                            y: 0,
                            ease: 'Expo.easeInOut'
                        })

                        TweenMax.to( this.items[i].uniforms.progress, 1.5, {
                            value: 1,
                            ease: 'Expo.easeInOut'
                        })
        
                        TweenMax.to( this.grid.position, 1.5, {
                            z: -this.items[i].mesh.position.z + 200,
                            ease: 'Expo.easeInOut'
                        })
        
                        this.items.forEach( item => {
        
                            if( item === this.items[i] ) return
        
                            TweenMax.to( item.material.uniforms.opacity, 1.5, {
                                value: 0,
                                ease: 'Expo.easeInOut'
                            })
        
                        })

                    }

                }

                this.grid.add( this.items[i].mesh )
                // this.grid.add( this.items[i].label )

                x++
                if( x === 6 ) x = 0

            }

            this.animate()

        })

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

        this.items.forEach( item => {

            // TweenMax.to( item.mesh.rotation, 3, {
            //     x: -this.mouse.y * 0.5,
            //     y: -this.mouse.x * 0.5,
            //     ease: 'Power4.easeOut',
            // })

            // TweenMax.to( item.mesh.position, 3, {
            //     x: -this.mouseX * 15,
            //     y: -this.mouseY * 15,
            //     ease: 'Power4.easeOut',
            // });

        })

        TweenMax.to( this.camera.rotation, 3, {
            x: -this.mouse.y * 0.5,
            y: -this.mouse.x * 0.5,
            ease: 'Power4.easeOut',
        })

        this.updatingPerspective = false

    }

    animate() {

        this.animationId = requestAnimationFrame( this.animate.bind(this) )

        let elapsedMilliseconds = Date.now() - this.c.startTime
        this.items[0].uniforms.time.value = elapsedMilliseconds / 1000

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

            this.items.forEach( item => {

                TweenMax.to( item.uniforms.gradientColor.value, 3, {
                    r: targetColor.r,
                    g: targetColor.g,
                    b: targetColor.b,
                    ease: 'Expo.easeInOut'
                })

            })

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

}

const grid = new PerspectiveGrid()
window.grid = grid