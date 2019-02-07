import * as THREE from 'three'
import { TweenMax } from 'gsap'

import vert from '../shaders/shader.vert'
import frag from '../shaders/shader.frag'
import months from './months'

export default class Timeline {

    constructor() {

        this.setConfig()
        this.init()

        if( !window.assets ) {
            this.loadAssets()
        } else {
            this.assets = window.assets
            this.createTimeline()
        }
        

    }

    setConfig() {

        this.c = {
            dpr: window.devicePixelRatio >= 2 ? 2 : 1,
            startTime: Date.now(),
            size: {
                w: window.innerWidth,
                h: window.innerHeight
            },
            scrollPos: 0,
            scrolling: false,
            allowScrolling: true
        }

        this.activeMonth = 'jan'
        this.months = months
        this.monthPositions = {}
        this.remainingMonths = []

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
                    videoTex.size = new THREE.Vector2( videoTex.image.videoWidth / 2, videoTex.image.videoHeight / 2 )
                    videoTex.anisotropy = this.renderer.capabilities.getMaxAnisotropy()

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
                'berlin-1-2.JPG',
                'berlin-2-2.JPG',
                'berlin-3.JPG',
                'iceland_dribbble.jpg',
                'kayak.jpg',
                'roadless.jpg',
                'shot.jpg',
                'soft-drinks.jpg',
                'tiles.jpg'
            ],
            february: [
                // 'iat.jpg',
                // 'jekka.jpg'
            ],
            march: [
                // 'nath.jpg',
                // 'sign.jpg'
            ]
        }

        for( let month in images ) {
            images[month].forEach( filename => {

                assetLoadPromises.push( new Promise( resolve => {

                    imageLoader.load( `assets/${month}/${filename}`, texture => {

                        texture.name = `${month}/${filename}`
                        texture.size = new THREE.Vector2( texture.image.width / 2, texture.image.height / 2 )
                        texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy()
                        resolve( texture )

                    })

                }))

            })
        }

        // Load Fonts
        let fontLoader = new THREE.FontLoader()
        let fonts = [
            'fonts/schnyder.json',
            'fonts/suisse.json'
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

            this.createTimeline()

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
        this.raycaster.near = this.camera.near
        this.raycaster.far = this.camera.far
        this.mouse = new THREE.Vector2()

    }

    createTimeline() {

        this.timeline = new THREE.Group()
        this.scene.add( this.timeline )
            
        this.textMat = new THREE.MeshBasicMaterial( { color: 0x1b42d8, transparent: true } )
        this.textOutlineMat = new THREE.MeshBasicMaterial( { color: 0x1b42d8, transparent: true, wireframe: true } )

        this.sections = {}
        this.items = {}
        this.itemMeshes = [] // array for raytracing

        let monthIndex = 0, itemIndexTotal = 0, nextMonthPos = 0

        for( let key in this.months ) {

            this.sections[ key ] = new THREE.Group()

            if( key === 'intro' ) {

                let yearInReviewGeom = new THREE.TextGeometry( 'YEAR IN REVIEW', {
                    font: this.assets.fonts['SuisseIntl-Bold'],
                    size: 50,
                    height: 0,
                    curveSegments: 20
                } )
        
                yearInReviewGeom.center()

                let yearInReview = new THREE.Mesh( yearInReviewGeom, this.textMat )
                this.sections[ key ].add( yearInReview )

                let yearTextGeom = new THREE.TextGeometry( '2018', {
                    font: this.assets.fonts['Schnyder L'],
                    size: 380,
                    height: 0,
                    curveSegments: 20
                } )
        
                yearTextGeom.center()

                let yearText = new THREE.Mesh( yearTextGeom, this.textOutlineMat )
                yearText.position.set( 0, 0, -200 )
                this.sections[ key ].add( yearText )

            } else {

                let textGeom = new THREE.TextGeometry( this.months[key].name, {
                    font: this.assets.fonts['Schnyder L'],
                    size: 200,
                    height: 0,
                    curveSegments: 20
                } )
        
                textGeom.center()

                let monthName = new THREE.Mesh( textGeom, this.textMat )
                monthName.position.set( 0, 0, 0 )
                this.sections[key].add( monthName )

                let itemIndex = 0

                // add items
                for( let id in this.assets.textures ) {

                    this.items[id + monthIndex] = {}

                    this.items[id + monthIndex].uniforms = {
                        time: { type: 'f', value: 1.0 },
                        fogColor: { type: "c", value: this.scene.fog.color },
                        fogNear: { type: "f", value: this.scene.fog.near },
                        fogFar: { type: "f", value: this.scene.fog.far },
                        texture: { type: 't', value: this.assets.textures[ id ] },
                        opacity: { type: 'f', value: 1.0 },
                        progress: { type: 'f', value: 0.0 },
                        gradientColor: { type: 'vec3', value: new THREE.Color(0x1b42d8) }
                    }

                    this.items[id + monthIndex].geometry = new THREE.PlaneGeometry( 1, 1 )
                    this.items[id + monthIndex].material = new THREE.ShaderMaterial({
                        uniforms: this.items[id + monthIndex].uniforms,
                        fragmentShader: frag,
                        vertexShader: vert,
                        fog: true,
                        transparent: true
                    })

                    this.items[id + monthIndex].mesh = new THREE.Mesh( this.items[id + monthIndex].geometry, this.items[id + monthIndex].material )
                    this.items[id + monthIndex].mesh.scale.set( this.assets.textures[ id ].size.x, this.assets.textures[ id ].size.y, 1 )

                    let align = itemIndexTotal % 4, pos = new THREE.Vector2()

                    if( align === 0 ) pos.set( -350, 350 ) // bottom left
                    if( align === 1 ) pos.set( 350, 350 ) // bottom right
                    if( align === 2 ) pos.set( 350, -350 ) // top right
                    if( align === 3 ) pos.set( -350, -350 ) // top left

                    this.items[id + monthIndex].mesh.position.set( pos.x, pos.y, itemIndex * -300 )
                    this.items[id + monthIndex].origPos = new THREE.Vector2( pos.x, pos.y )

                    this.items[id + monthIndex].mesh.onClick = this.onItemClick.bind( this, this.items[id + monthIndex] )

                    this.sections[key].add( this.items[id + monthIndex].mesh )
                    this.itemMeshes.push( this.items[id + monthIndex].mesh )

                    itemIndex++
                    itemIndexTotal++

                }

            }

            let bbox = new THREE.Box3().setFromObject( this.sections[ key ] );

            this.sections[key].position.z = nextMonthPos
            this.monthPositions[key] = nextMonthPos + 1100 ;
            nextMonthPos += Math.min( bbox.min.z, 0 ) - ( key === 'intro' ? 1300 : 800 ) // TODO: get from camera?

            monthIndex++

            this.timeline.add( this.sections[key] )

        }

        this.animate()
        this.initListeners()

    }

    onItemClick( item ) {

        if( item.active ) {

            item.active = false

            TweenMax.to( item.mesh.position, 1.5, {
                x: item.origPos.x,
                y: item.origPos.y,
                ease: 'Expo.easeInOut'
            })

            TweenMax.to( this.timeline.position, 1.5, {
                z: this.origTimelinePos,
                ease: 'Expo.easeInOut',
                onComplete: () => {
                    this.c.allowScrolling = true
                }
            })

            TweenMax.to( item.uniforms.progress, 1.5, {
                value: 0,
                ease: 'Expo.easeInOut'
            })

            TweenMax.to( this.textMat, 1.5, {
                opacity: 1,
                ease: 'Expo.easeInOut',
                onStart: () => {
                    this.textMat.visible = true
                }
            })

            for( let x in this.items ) {

                if( this.items[x].active ) continue

                TweenMax.to( this.items[x].material.uniforms.opacity, 1.5, {
                    value: 1,
                    ease: 'Expo.easeInOut'
                })

            }

        } else {

            item.active = true
            this.origTimelinePos = this.timeline.position.z
            this.c.allowScrolling = false

            TweenMax.to( item.mesh.position, 1.5, {
                x: 0,
                y: 0,
                ease: 'Expo.easeInOut'
            })

            TweenMax.to( item.uniforms.progress, 1.5, {
                value: 1,
                ease: 'Expo.easeInOut'
            })

            TweenMax.to( this.timeline.position, 1.5, {
                z: -(this.sections[ this.activeMonth ].position.z - -item.mesh.position.z) + 100,
                ease: 'Expo.easeInOut'
            })

            TweenMax.to( this.textMat, 1.5, {
                opacity: 0,
                ease: 'Expo.easeInOut',
                onComplete: () => {
                    this.textMat.visible = false
                }
            })

            for( let x in this.items ) { // TODO: see if can select just in camera range

                if( this.items[x].active ) continue

                TweenMax.to( this.items[x].material.uniforms.opacity, 1.5, {
                    value: 0,
                    ease: 'Expo.easeInOut'
                })

            }

        }
    
    }

    scroll( e ) {

        let delta = normalizeWheelDelta(e)

        this.c.scrollPos += -delta * 20
        this.c.scrolling = true;        
        
        function normalizeWheelDelta(e){
            if(e.detail){
                if(e.wheelDelta)
                    return e.wheelDelta/e.detail/40 * (e.detail>0 ? 1 : -1) // Opera
                else
                    return -e.detail/3 // Firefox TODO: fix
            } else
                return e.wheelDelta/120 // IE,Safari,Chrome
        }

    }

    mouseDown( e ) {

        e.preventDefault();

        this.mouse.x = ( e.clientX / this.renderer.domElement.clientWidth ) * 2 - 1
        this.mouse.y = - ( e.clientY / this.renderer.domElement.clientHeight ) * 2 + 1

        this.raycaster.setFromCamera( this.mouse, this.camera )

        let intersects = this.raycaster.intersectObjects( this.itemMeshes )

        if ( intersects.length > 0 ) {

            if( intersects[0].object.onClick )
            intersects[0].object.onClick()

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

    changeColours() {

        this.remainingMonths = Object.keys( this.monthPositions ).filter( key => {
            return this.timeline.position.z > -this.monthPositions[key] // TODO: look into detecting if exists in camera
        } )

        if( this.remainingMonths[ this.remainingMonths.length - 1 ] && this.activeMonth !== this.remainingMonths[ this.remainingMonths.length - 1 ] ) {

            this.activeMonth = this.remainingMonths[ this.remainingMonths.length - 1 ]

            let bgColor = new THREE.Color( this.months[ this.activeMonth ].bgColor )
            let textColor = new THREE.Color( this.months[ this.activeMonth ].textColor )
            let tintColor = new THREE.Color( this.months[ this.activeMonth ].tintColor )

            TweenMax.to( this.scene.fog.color, 1, {
                r: bgColor.r,
                g: bgColor.g,
                b: bgColor.b,
                ease: 'Power4.easeOut'
            })

            TweenMax.to( this.scene.background, 1, {
                r: bgColor.r,
                g: bgColor.g,
                b: bgColor.b,
                ease: 'Power4.easeOut'
            })

            TweenMax.to( [ this.textMat.color, this.textMat.emissive ], 1, {
                r: textColor.r,
                g: textColor.g,
                b: textColor.b,
                ease: 'Power4.easeOut'
            })

            for( let id in this.items ) {

                TweenMax.to( this.items[id].uniforms.gradientColor.value, 1, {
                    r: tintColor.r,
                    g: tintColor.g,
                    b: tintColor.b,
                    ease: 'Power4.easeOut'
                })

            }

        }

    }

    animate() {

        this.animationId = requestAnimationFrame( this.animate.bind(this) )

        // let elapsedMilliseconds = Date.now() - this.c.startTime
        // this.items[0].uniforms.time.value = elapsedMilliseconds / 1000

        if( this.updatingPerspective ) {
            this.updatePerspective()
            this.updatingPerspective = false
        }

        // smooth scrolling
        if( this.c.allowScrolling && this.c.scrolling ) {

            let delta = ( this.c.scrollPos - this.timeline.position.z ) / 12
            this.timeline.position.z += delta

            this.changeColours()

            if( Math.abs( delta ) > 0.1 ) {
                this.c.scrolling = true
            } else {
                this.c.scrolling = false
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