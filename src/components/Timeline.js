import * as THREE from 'three'
import { TweenMax } from 'gsap'
import CSSRulePlugin from 'gsap/CSSRulePlugin'
import TinyGesture from 'tinygesture'
import DeviceOrientationControls from './three-orientation-controls'

import vert from '../shaders/shader.vert'
import frag from '../shaders/shader.frag'
import greenscreen from '../shaders/greenscreen.frag'
import months from './months'
import assets from '../assets'
import assetOrder from '../assetOrder'

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

        this.dom = {
            cursor: document.querySelector('.cursor')
        }

        this.c = {
            dpr: window.devicePixelRatio >= 2 ? 2 : 1,
            startTime: Date.now(),
            size: {
                w: window.innerWidth,
                h: window.innerHeight
            },
            scrollPos: 0,
            scrolling: false,
            allowScrolling: true,
            autoMoveSpeed: 0,
            holdingMouseDown: false,
            touchEnabled: ('ontouchstart' in window)
        }

        if( this.c.touchEnabled ) document.documentElement.classList.add('touch-enabled')

        this.assetList = assets

        this.activeMonth = 'intro'
        this.months = months
        this.monthPositions = {}
        this.remainingMonths = []
        
    }

    loadAssets() {

        this.assets = {
            textures: {},
            fonts: {}
        }
        let assetLoadPromises = []

        // Load images + videos
        let imageLoader = new THREE.TextureLoader()
        imageLoader.crossOrigin = ''

        let preload = false

        for( let month in this.assetList ) {

            preload = month === 'intro' ? true : false

            this.assetList[month].forEach( filename => {

                if( ~filename.indexOf( '.mp4' ) ) {

                    let video = document.createElement( 'video' );
                    video.style = 'position:absolute;height:0'
                    video.muted = true
                    video.autoplay = false
                    video.loop = true
                    video.crossOrigin = 'anonymous'
                    video.setAttribute('webkit-playsinline', true)
                    video.src = `assets/${month}/${filename}`
                    document.body.appendChild( video )
                    video.load(); // must call after setting/changing source

                    if( preload ) {

                        assetLoadPromises.push( new Promise( resolve => {
                            video.oncanplaythrough = () => this.createVideoTexture( video, month, filename, resolve )
                        }))

                    } else {

                        this.createVideoTexture( video, month, filename, false )

                    }

                } else {

                    if( preload ) {

                        assetLoadPromises.push( new Promise( resolve => {
                            imageLoader.load( `assets/${month}/${filename}`, texture => this.createImageTexture( texture, month, filename, resolve ) )
                        }))

                    } else {

                        this.createImageTexture( false, month, filename, false )

                    }

                }

            })

        }

        // Load Fonts
        let fontLoader = new THREE.FontLoader()
        let fonts = [
            'fonts/schnyder.json',
            'fonts/schnyder-outline.json',
            'fonts/suisse.json',
        ]

        for( let i = 0; i < fonts.length; i++ ) {
            assetLoadPromises.push( new Promise( resolve => fontLoader.load( fonts[i], font => {
                this.assets.fonts[ font.data.familyName ] = font
                resolve() 
            } ) ) )
        }

        Promise.all( assetLoadPromises ).then( assets => {

            console.log('ASSETS LOADED');

            // all assets loaded - initialise
            this.createTimeline()

        })

    }

    createImageTexture( texture, month, filename, resolve ) {
        
        // if preloaded
        if( resolve ) {

            texture.size = new THREE.Vector2( texture.image.width / 2, texture.image.height / 2 )
            texture.needsUpdate = true
            this.renderer.setTexture2D( texture, 0 )

            texture.name = `${month}/${filename}`
            texture.mediaType = 'image'
            texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy()

            if( !this.assets.textures[ month ] ) this.assets.textures[ month ] = {}
            this.assets.textures[ month ][ texture.name ] = texture
        
            resolve( texture )

        } else {

            let texture = new THREE.TextureLoader().load( `assets/${month}/${filename}`, texture => {

                texture.size = new THREE.Vector2( texture.image.width / 2, texture.image.height / 2 )
                texture.needsUpdate = true
                this.renderer.setTexture2D( texture, 0 )

            } )
            texture.size = new THREE.Vector2( 10, 10 )

            texture.name = `${month}/${filename}`
            texture.mediaType = 'image'
            texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy()

            if( !this.assets.textures[ month ] ) this.assets.textures[ month ] = {}
            this.assets.textures[ month ][ texture.name ] = texture

        }

    }

    createVideoTexture( video, month, filename, resolve ) {

        let texture = new THREE.VideoTexture( video )
        texture.minFilter = texture.magFilter = THREE.LinearFilter
        texture.name = `${month}/${filename}`
        texture.mediaType = 'video'
        texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy()

        // if preloaded
        if( resolve ) {

            texture.size = new THREE.Vector2( texture.image.videoWidth / 2, texture.image.videoHeight / 2 )
    
            resolve( texture )
            video.oncanplaythrough = null

        } else {

            texture.size = new THREE.Vector2( 1, 1 )

            video.oncanplaythrough = () => {
                texture.size = new THREE.Vector2( texture.image.videoWidth / 2, texture.image.videoHeight / 2 )
                texture.needsUpdate = true
                video.oncanplaythrough = null
            }

        }

        if( !this.assets.textures[ month ] ) this.assets.textures[ month ] = {}
        this.assets.textures[ month ][ texture.name ] = texture

    }

    init() {

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
        this.renderer.setPixelRatio( this.c.dpr )
        this.renderer.setSize( this.c.size.w, this.c.size.h )
        document.body.appendChild( this.renderer.domElement )
        this.preventPullToRefresh()

        this.scene = new THREE.Scene()
        this.scene.background = new THREE.Color( 0xAEC7C3 )
        this.scene.fog = new THREE.Fog( 0xAEC7C3, 1400, 2000 )

        let cameraPosition = 800;

        const fov = 180 * ( 2 * Math.atan( this.c.size.h / 2 / cameraPosition ) ) / Math.PI // TODO: fix mobile scaling
        this.camera = new THREE.PerspectiveCamera( fov, this.c.size.w / this.c.size.h, 1, 2000 )
        // this.camera.lookAt( this.scene.position )
        this.camera.position.z = cameraPosition

        // this.cameraHolder = new THREE.Object3D()
        // this.cameraHolder.lookAt( this.scene.position )
        // this.cameraHolder.add( this.camera )
        // this.cameraHolder.position.z = cameraPosition
        // this.scene.add( this.cameraHolder )

        this.raycaster = new THREE.Raycaster()
        this.raycaster.near = this.camera.near
        this.raycaster.far = this.camera.far
        this.frustum = new THREE.Frustum()
        this.cameraViewProjectionMatrix = new THREE.Matrix4()
        this.mouse = new THREE.Vector2()
        this.mousePerspective = new THREE.Vector2()

        window.addEventListener( 'devicemotion', event => {
            if( event.rotationRate.alpha || event.rotationRate.beta || event.rotationRate.gamma ) {
                if( !this.controls ) {
                    this.controls = new DeviceOrientationControls( this.camera )
                }
            }
        })

    }

    createTimeline() {

        this.timeline = new THREE.Group()
        this.scene.add( this.timeline )
            
        this.textMat = new THREE.MeshBasicMaterial( { color: 0x1b42d8, transparent: true } )
        this.textOutlineMat = new THREE.MeshBasicMaterial( { color: 0x1b42d8, transparent: true, wireframe: false } )

        this.sections = {}
        this.items = {}
        this.itemMeshes = [] // array for raytracing
        this.videoItems = []

        let itemIndexTotal = 0, nextMonthPos = 0

        for( let key in this.months ) {

            this.sections[ key ] = new THREE.Group()

            if( key === 'intro' ) {

                let sansTextGeom = new THREE.TextGeometry( 'YEAR IN REVIEW', {
                    font: this.assets.fonts['SuisseIntl-Bold'],
                    size: 50,
                    height: 0,
                    curveSegments: 4
                } )
        
                sansTextGeom.center()

                let sansText = new THREE.Mesh( sansTextGeom, this.textMat )
                this.sections[ key ].add( sansText )

                let serifTextGeom = new THREE.TextGeometry( '2018', {
                    font: this.assets.fonts['Schnyder_Edit Outline'],
                    size: 490,
                    height: 0,
                    curveSegments: 15
                } )
        
                serifTextGeom.center()

                let serifText = new THREE.Mesh( serifTextGeom, this.textOutlineMat )
                serifText.position.set( 0, 0, -500 )
                this.sections[ key ].add( serifText )

                let material = new THREE.MeshBasicMaterial( { map: this.assets.textures[key]['intro/ok.png'], transparent: true } )
                let geom = new THREE.PlaneGeometry( 1, 1 )
                let hand = new THREE.Mesh( geom, material )
                hand.scale.set( 1000, 1000, 1 )
                hand.position.set( 0, 0, -250 )
                this.sections[ key ].add( hand )

            } else if( key === 'end' ) {

                let sansTextGeom = new THREE.TextGeometry( 'SEE YOU NEXT TIME', {
                    font: this.assets.fonts['SuisseIntl-Bold'],
                    size: 50,
                    height: 0,
                    curveSegments: 4
                } )
        
                sansTextGeom.center()

                let sansText = new THREE.Mesh( sansTextGeom, this.textMat )
                this.sections[ key ].add( sansText )

                let serifTextGeom = new THREE.TextGeometry( 'END', {
                    font: this.assets.fonts['Schnyder_Edit Outline'],
                    size: 400,
                    height: 0,
                    curveSegments: 15
                } )
        
                serifTextGeom.center()

                let serifText = new THREE.Mesh( serifTextGeom, this.textOutlineMat )
                serifText.position.set( 0, 0, -300 )
                this.sections[ key ].add( serifText )

                let geometry = new THREE.PlaneGeometry( 1, 1 )
                let material = new THREE.ShaderMaterial({
                    uniforms: {
                        fogColor: { type: "c", value: this.scene.fog.color },
                        fogNear: { type: "f", value: this.scene.fog.near },
                        fogFar: { type: "f", value: this.scene.fog.far },
                        texture: { type: 't', value: this.assets.textures[key][ 'end/glit.mp4' ] }
                    },
                    fragmentShader: greenscreen,
                    vertexShader: vert,
                    fog: true,
                    transparent: true
                })

                let mesh = new THREE.Mesh( geometry, material )
                mesh.scale.set( 700, 700, 1 )
                mesh.position.set( 0, 0, -200 )

                // this.assets.textures[key][ 'end/glit.mp4' ].image.play() // TODO: play when enters camera

                this.sections[ key ].add( mesh )

            } else {

                let textGeom = new THREE.TextGeometry( this.months[key].name, {
                    font: this.assets.fonts['Schnyder L'],
                    size: 200,
                    height: 0,
                    curveSegments: 10
                } )
        
                textGeom.center()

                let monthName = new THREE.Mesh( textGeom, this.textMat )
                monthName.position.set( 0, 0, 0 )
                this.sections[key].add( monthName )

                let itemIndex = 0

                // add items
                for( let id in this.assets.textures[ key ] ) {

                    this.items[id] = {}

                    this.items[id].uniforms = {
                        time: { type: 'f', value: 1.0 },
                        fogColor: { type: "c", value: this.scene.fog.color },
                        fogNear: { type: "f", value: this.scene.fog.near },
                        fogFar: { type: "f", value: this.scene.fog.far },
                        texture: { type: 't', value: this.assets.textures[key][ id ] },
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
                    this.items[id].mesh.scale.set( this.assets.textures[key][ id ].size.x, this.assets.textures[key][ id ].size.y, 1 )

                    // updates size of meshes after texture has been loaded
                    this.assets.textures[key][ id ].onUpdate = () => {
                        if( this.items[id].mesh.scale.x !== this.assets.textures[key][ id ].size.x && this.items[id].mesh.scale.y !== this.assets.textures[key][ id ].size.y ) {
                            this.items[id].mesh.scale.set( this.assets.textures[key][ id ].size.x, this.assets.textures[key][ id ].size.y, 1 )
                            this.assets.textures[key][ id ].onUpdate = null
                        }
                    }

                    let align = itemIndexTotal % 4, pos = new THREE.Vector2()

                    if( align === 0 ) pos.set( -350, 350 ) // bottom left
                    if( align === 1 ) pos.set( 350, 350 ) // bottom right
                    if( align === 2 ) pos.set( 350, -350 ) // top right
                    if( align === 3 ) pos.set( -350, -350 ) // top left

                    this.items[id].align = align
                    this.items[id].mesh.position.set( pos.x, pos.y, ( itemIndex * -300 ) - 200 )
                    this.items[id].origPos = new THREE.Vector2( pos.x, pos.y )
                    this.items[id].month = key

                    this.items[id].mesh.openItem = this.openItem.bind( this, this.items[id] )

                    this.sections[key].add( this.items[id].mesh )
                    this.itemMeshes.push( this.items[id].mesh )

                    if( this.assets.textures[key][ id ].mediaType === 'video' ) {
                        this.videoItems.push( this.items[id].mesh )
                    }

                    itemIndex++
                    itemIndexTotal++

                }

            }

            let bbox = new THREE.Box3().setFromObject( this.sections[ key ] );

            this.sections[key].position.z = nextMonthPos
            this.monthPositions[key] = nextMonthPos + 1100 ;
            let posOffset = 800; // TODO: get from camera?
            if( key === 'intro' ) posOffset = 1300
            if( key === 'dec' ) posOffset = 1800
            nextMonthPos += bbox.min.z - posOffset

            this.timeline.add( this.sections[key] )

            if( key === 'end' ) {
                this.stopScrollPos = this.sections[key].position.z
            }

        }

        this.videoCount = this.videoItems.length - 1

        console.log('RENDER')
        this.addIntroBadge()
        this.animate()
        this.initListeners()

    }

    addIntroBadge() {

        this.badge = new THREE.Group()

        let texture = new THREE.TextureLoader().load( 'images/highlights.png' )
        let material = new THREE.MeshBasicMaterial( { map: texture, transparent: true } )
        let geom = new THREE.PlaneGeometry( 1, 1 )
        this.circle = new THREE.Mesh( geom, material )
        this.circle.scale.set( 200, 200, 1 )
        this.badge.add( this.circle )

        let serifTextGeom = new THREE.TextGeometry( '2018-19', {
            font: this.assets.fonts['Schnyder L'],
            size: 26,
            height: 0,
            curveSegments: 10
        } )

        serifTextGeom.center()

        let serifText = new THREE.Mesh( serifTextGeom, this.textMat )
        serifText.position.set( 0, 0, 1 )
        this.badge.add( serifText )

        this.badge.position.set( 0, -this.c.size.h / 2 + 90, 50 )

        this.timeline.add( this.badge )

    }

    openItem( item ) {

        this.itemAnimating = true
        this.itemOpen = item
        this.origTimelinePos = this.timeline.position.z
        this.c.allowScrolling = false

        let posOffset = this.sections[ this.activeMonth ].position.z;

        if( item.month !== this.activeMonth ) {
            posOffset = this.sections[ this.remainingMonths[ this.remainingMonths.length - 2 ] ].position.z
        }

        TweenMax.to( item.mesh.position, 1.5, {
            x: 0,
            y: 0,
            ease: 'Expo.easeInOut',
            onComplete: () => {
                this.itemAnimating = false
                this.dom.cursor.dataset.cursor = 'cross'
            }
        })

        TweenMax.to( item.uniforms.progress, 1.5, {
            value: 1,
            ease: 'Expo.easeInOut'
        })

        TweenMax.to( this.timeline.position, 1.5, {
            z: -(posOffset - -item.mesh.position.z) + 300,
            ease: 'Expo.easeInOut'
        })

        TweenMax.to( this.textMat, 1, {
            opacity: 0, 
            ease: 'Expo.easeInOut',
            onComplete: () => {
                this.textMat.visible = false
            }
        })

        let pos = new THREE.Vector2()

        for( let x in this.items ) { // TODO: see if can select just in camera range + a bit more for the timeline move

            if( this.items[x].align === 0 ) pos.set( -700, 700 ) // bottom left
            if( this.items[x].align === 1 ) pos.set( 700, 700 ) // bottom right
            if( this.items[x].align === 2 ) pos.set( 700, -700 ) // top right
            if( this.items[x].align === 3 ) pos.set( -700, -700 ) // top left

            if( this.items[x] === item ) continue

            TweenMax.to( this.items[x].material.uniforms.opacity, 1.3, {
                value: 0,
                ease: 'Expo.easeInOut'
            })

            TweenMax.to( this.items[x].mesh.position, 1.5, {
                x: pos.x,
                y: pos.y,
                ease: 'Expo.easeInOut'
            })

        }

    }

    closeItem() {

        if( !this.itemAnimating && this.itemOpen ) {

            this.itemAnimating = true
            this.dom.cursor.dataset.cursor = 'pointer'

            TweenMax.to( this.itemOpen.mesh.position, 1.5, {
                x: this.itemOpen.origPos.x,
                y: this.itemOpen.origPos.y,
                ease: 'Expo.easeInOut'
            })

            TweenMax.to( this.timeline.position, 1.5, {
                z: this.origTimelinePos,
                ease: 'Expo.easeInOut',
                onComplete: () => {
                    this.c.allowScrolling = true
                    this.itemOpen = false
                    this.itemAnimating = false
                }
            })

            TweenMax.to( this.itemOpen.uniforms.progress, 1.5, {
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

                TweenMax.to( this.items[x].mesh.position, 1.5, {
                    x: this.items[x].origPos.x,
                    y: this.items[x].origPos.y,
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

        this.c.holdingMouseDown = true

        if( this.itemOpen ) {

            this.closeItem()

        } else {

            if ( this.intersects.length > 0 ) {

                if( this.intersects[0].object.openItem ) {
                    this.intersects[0].object.openItem()
                    this.dom.cursor.dataset.cursor = 'cross'
                }

            } else {

                this.dom.cursor.dataset.cursor = 'move'

                TweenMax.to( this.c, 0.5, {
                    delay: 0.6,
                    autoMoveSpeed: 20
                } )

            }

        }

    }

    mouseUp() {

        if( !this.itemOpen ) this.dom.cursor.dataset.cursor = 'pointer'
        this.c.holdingMouseDown = false
        TweenMax.killTweensOf( this.c, { autoMoveSpeed: true } )
        this.c.autoMoveSpeed = 0

    }

    mouseMove( e ) {

        if( !this.itemOpen && !this.c.holdingMouseDown ) {

            this.mouse.x = ( e.clientX / this.renderer.domElement.clientWidth ) * 2 - 1
            this.mouse.y = - ( e.clientY / this.renderer.domElement.clientHeight ) * 2 + 1

            this.raycaster.setFromCamera( this.mouse, this.camera )

            this.intersects = this.raycaster.intersectObjects( this.itemMeshes )

            if ( this.intersects.length > 0 ) {
                this.dom.cursor.dataset.cursor = 'eye'
            } else if ( this.dom.cursor.dataset.cursor !== 'pointer' ) {
                this.dom.cursor.dataset.cursor = 'pointer'
            }

        }

        this.mousePerspective.x = e.clientX / window.innerWidth - 0.5
        this.mousePerspective.y = e.clientY / window.innerHeight - 0.5
        this.updatingPerspective = true

        if( !this.c.touchEnabled ) {
            TweenMax.to( '.cursor', 1.5, {
                x: e.clientX,
                y: e.clientY,
                ease: 'Power4.easeOut'
            })
        }

    }

    updatePerspective() {

        TweenMax.to( this.camera.rotation, 4, {
            x: -this.mousePerspective.y * 0.5,
            y: -this.mousePerspective.x * 0.5,
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
            let svgRule = CSSRulePlugin.getRule('main svg')
            let svgCursorRule = CSSRulePlugin.getRule('.cursor svg')
            let interfaceColor

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

            if( this.months[ this.activeMonth ].outlineTextColor ) {

                let outlineTextColor = new THREE.Color( this.months[ this.activeMonth ].outlineTextColor )
                interfaceColor = outlineTextColor.getHexString()

                TweenMax.to( [ this.textOutlineMat.color, this.textOutlineMat.emissive ], 1, {
                    r: outlineTextColor.r,
                    g: outlineTextColor.g,
                    b: outlineTextColor.b,
                    ease: 'Power4.easeOut'
                })
                
            } else {

                interfaceColor = textColor.getHexString()
    
            }

            TweenLite.to( svgRule, 1, { cssRule: { fill: '#' + interfaceColor }, ease: 'Power4.easeOut' } )
            TweenLite.to( svgCursorRule, 1, { cssRule: { stroke: '#' + interfaceColor }, ease: 'Power4.easeOut' } )

        }

    }

    handleVideos() {

        this.camera.updateMatrixWorld();
        this.camera.matrixWorldInverse.getInverse( this.camera.matrixWorld );
        this.cameraViewProjectionMatrix.multiplyMatrices( this.camera.projectionMatrix, this.camera.matrixWorldInverse );
        this.frustum.setFromMatrix( this.cameraViewProjectionMatrix );

        for( let i = 0; i < this.videoCount; i++ ) {

            if( this.frustum.intersectsObject( this.videoItems[ i ] ) && this.videoItems[ i ].material.uniforms.texture.value.image.paused ) {
                this.videoItems[ i ].material.uniforms.texture.value.image.play()
                continue
            }
            
            if ( !this.frustum.intersectsObject( this.videoItems[ i ] ) && !this.videoItems[ i ].material.uniforms.texture.value.image.paused ) {
                this.videoItems[ i ].material.uniforms.texture.value.image.pause()
            }

        }

    }

    animate() {

        this.animationId = requestAnimationFrame( this.animate.bind(this) )

        if( !this.c.touchEnabled && this.updatingPerspective ) {
            this.updatePerspective()
            this.updatingPerspective = false
        }

        if( this.c.autoMoveSpeed > 0 ) {
            this.c.scrolling = true
            this.c.scrollPos += this.c.autoMoveSpeed
        }

        // smooth scrolling
        if( this.c.allowScrolling && this.c.scrolling ) {

            if( this.c.scrollPos <= 0 ) this.c.scrollPos = 0
            if( this.c.scrollPos >= -this.stopScrollPos ) this.c.scrollPos = -this.stopScrollPos

            let delta = ( this.c.scrollPos - this.timeline.position.z ) / 12
            this.timeline.position.z += delta

            this.handleVideos()
            this.changeColours()

            if( this.timeline.position.z < 700 ) {
                TweenMax.set( this.circle.rotation, {
                    z: '+=' + delta * 0.005
                })
            }

            if( Math.abs( delta ) > 0.1 ) {
                this.c.scrolling = true
            } else {
                this.c.scrolling = false
            }

        }

        if( this.controls ) this.controls.update()

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
        this.mouseUp = this.mouseUp.bind( this )
        addEventListener( 'resize', this.resize )
        addEventListener( 'mousemove', this.mouseMove )
        addEventListener( 'mousedown', this.mouseDown )
        addEventListener( 'mouseup', this.mouseUp )
        this.renderer.domElement.addEventListener( 'wheel', this.scroll )

        this.gesture = new TinyGesture( this.renderer.domElement, { mouseSupport: false } )

        this.gesture.on( 'panmove', event => {

            this.c.scrollPos += -this.gesture.velocityY * 6
            this.c.scrolling = true;

        })

        this.gesture.on( 'panend', event => {

            this.c.autoMoveSpeed = 0

        })

        this.gesture.on( 'longpress', event => {

            this.c.autoMoveSpeed = 10

        })

        if( !this.c.touchEnabled ) {
            this.dom.cursor.dataset.cursor = 'pointer'
        }

    }

    preventPullToRefresh() {
        var prevent = false;
    
        this.renderer.domElement.addEventListener('touchstart', function(e){
          if (e.touches.length !== 1) { return; }
    
          var scrollY = window.pageYOffset || document.body.scrollTop || document.documentElement.scrollTop;
          prevent = (scrollY === 0);
        });
    
        this.renderer.domElement.addEventListener('touchmove', function(e){
          if (prevent) {
            prevent = false;
            e.preventDefault();
          }
        });
    }

}