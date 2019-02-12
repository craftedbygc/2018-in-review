import * as THREE from 'three'
import frag from '../shaders/item.frag'
import vert from '../shaders/default.vert'

export default class Item extends THREE.Group {

    constructor( opts = { timeline, texture, data, month, itemIndex, itemIndexTotal } ) {
    
        super()
        Object.assign( this, opts )

        this.create()

    }

    create() {

        this.uniforms = {
            time: { type: 'f', value: 1.0 },
            fogColor: { type: "c", value: this.timeline.scene.fog.color },
            fogNear: { type: "f", value: this.timeline.scene.fog.near },
            fogFar: { type: "f", value: this.timeline.scene.fog.far },
            texture: { type: 't', value: this.texture },
            opacity: { type: 'f', value: 1.0 },
            progress: { type: 'f', value: 0.0 },
            gradientColor: { type: 'vec3', value: new THREE.Color(0x1b42d8) }
        }

        this.geometry = new THREE.PlaneGeometry( 1, 1 )
        this.material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            fragmentShader: frag,
            vertexShader: vert,
            fog: true,
            transparent: true
        })

        this.mesh = new THREE.Mesh( this.geometry, this.material )
        this.mesh.scale.set( this.texture.size.x, this.texture.size.y, 1 )

        // updates size of meshes after texture has been loaded
        this.texture.onUpdate = () => {
            if( this.mesh.scale.x !== this.texture.size.x && this.mesh.scale.y !== this.texture.size.y ) {
                this.mesh.scale.set( this.texture.size.x, this.texture.size.y, 1 )
                this.texture.onUpdate = null
            }
        }

        let align = this.itemIndexTotal % 4, pos = new THREE.Vector2()

        if( align === 0 ) pos.set( -350, 350 ) // bottom left
        if( align === 1 ) pos.set( 350, 350 ) // bottom right
        if( align === 2 ) pos.set( 350, -350 ) // top right
        if( align === 3 ) pos.set( -350, -350 ) // top left

        this.align = align
        this.position.set( pos.x, pos.y, ( this.itemIndex * -300 ) - 200 )
        this.origPos = new THREE.Vector2( pos.x, pos.y )

        this.add( this.mesh )

        this.addCaption()

        this.timeline.itemMeshes.push( this.mesh )

        if( this.texture.mediaType === 'video' ) {
            this.timeline.videoItems.push( this.mesh )
        }

    }

    addCaption() {

        if( this.data.caption === '' && this.data.link === '' ) return

        if( this.data.caption !== '' ) {

            let captionGeom = new THREE.TextGeometry( this.data.caption, {
                font: this.timeline.assets.fonts['Schnyder L'],
                size: 18,
                height: 0,
                curveSegments: 6
            } ).center()

            this.caption = new THREE.Mesh( captionGeom, this.timeline.captionTextMat )
            this.caption.position.set( 0, -this.mesh.scale.y / 2 - 50, 0 )
            this.caption.visible = false

            this.add( this.caption )

        }

        if( this.data.link !== '' ) {

            this.linkGroup = new THREE.Group()

            let linkGeom = new THREE.TextGeometry( 'SEE MORE', {
                font: this.timeline.assets.fonts['SuisseIntl-Bold'],
                size: 6,
                height: 0,
                curveSegments: 6
            } ).center()

            this.link = new THREE.Mesh( linkGeom, this.timeline.captionTextMat )

            this.linkUnderline = new THREE.Mesh(
                new THREE.PlaneBufferGeometry( 45, 1 ),
                this.timeline.linkUnderlineMat
            )
            this.linkUnderline.position.set( 0, -10, 0 )

            // for raycasting so it doesn't just pick up on letters
            this.linkBox = new THREE.Mesh(
                new THREE.PlaneBufferGeometry( 70, 20 ),
                new THREE.MeshBasicMaterial( { alphaTest: 0, visible: false } )
            )
            this.linkBox.onClick = () => {
                window.open( this.data.link, '_blank' )
            }

            this.linkGroup.position.set( 0, this.caption ? this.caption.position.y - 40  : -this.mesh.scale.y / 2 - 50, 0 )
            this.linkGroup.visible = false

            this.linkGroup.add( this.link )
            this.linkGroup.add( this.linkUnderline )
            this.linkGroup.add( this.linkBox )
            this.add( this.linkGroup )

        }

    }

}