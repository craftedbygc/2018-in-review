import progressPromise from '../utils/progressPromise'

export default class AssetLoader {

    constructor( isMobile ) {

        this.isMobile = isMobile
        this.assets = {
            textures: {},
            fonts: {}
        }
        this.assetList = {}
        this.renderer = null
        this.progressEl = document.querySelector( '.progress-percent' )
        this.progressBar = document.querySelector( '.progress-circle .line' )
        this.videosToLoad = 0
        this.videoBlobs = {}

    }

    load( assetList, renderer ) {

        this.request = indexedDB.open('videoDb', 1);
        this.request.onsuccess = event => {
            console.log(event);
            
            this.db = event.target.result;
            
        }
        this.request.onupgradeneeded = event => {
            const db = event.target.result;
            this.objectStore = db.createObjectStore('videos', { keyPath: 'name' });
        }

        this.assetList = assetList
        this.renderer = renderer

        let assetLoadPromises = []

        // Load images + videos
        let imageLoader = new THREE.TextureLoader()
        imageLoader.crossOrigin = ''

        let preload = true

        for( let month in this.assetList ) {

            // preload = month === 'intro' ? true : false

            this.assetList[month].forEach( filename => {

                if( ~filename.indexOf( '.mp4' ) ) {

                    let video = document.createElement( 'video' );
                    video.style = 'position:absolute;height:0'
                    video.muted = true
                    video.autoplay = false
                    video.loop = true
                    video.crossOrigin = 'anonymous'
                    video.setAttribute('muted', true)
                    video.setAttribute('webkit-playsinline', true)
                    video.preload = 'metadata'
                    // video.src = `assets/${month}/${filename}`
                    document.body.appendChild( video )
                    // video.load() // must call after setting/changing source

                    if( preload ) {

                        assetLoadPromises.push( new Promise( (resolve, reject) => {
                            this.videoPromise( video, month, filename, resolve )
                        } ) )

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

        return new Promise( resolve => {
            progressPromise( assetLoadPromises, this.update.bind(this) ).then( () => {

                // add videos to indexeddb
                var db = this.request.result;
                db.onerror = function(event) {
                    // Generic error handler for all errors targeted at this database's requests
                    console.error(event.target);
                    window.alert("Database error: " + event.target.wePutrrorMessage || event.target.error.name || event.target.error || event.target.errorCode);
                };
                var transaction = db.transaction('videos', "readwrite");
                var itemStore = transaction.objectStore("videos");

                let i = 0

                putNext.call( this )

                function putNext() {
                    if ( i < Object.keys( this.videoBlobs ).length ) {

                        itemStore.add( { name: Object.keys( this.videoBlobs )[i], arrayBuffer: this.videoBlobs[ Object.keys( this.videoBlobs )[i] ].buffer } ).onsuccess = putNext.bind( this )

                        ++i;
                    } else {   // complete
                        console.log('populate complete');

                        for( let key in this.videoBlobs ) {

                            const test = this.objectStore.get( key );

                            test.onerror = event => {
                                console.log('error');
                            };
                
                            test.onsuccess = event => {
                                this.videoBlobs[key].video.src = window.URL.createObjectURL( new Blob([test.result.arrayBuffer], {type: 'video/mp4'}) );
                            };

                        }

                        resolve( this.assets )
                        // callback();
                    }
                }

                // resolve( this.assets )
            });
        })

    }

    update( completed, total ) {

        let progress = Math.round( completed / total * 100 )
        this.progressEl.innerHTML = progress + '%'
        this.progressBar.style.strokeDashoffset = 252.363 - ( 252.363 * ( completed / total ) )

    }

    videoPromise( video, month, filename, resolve, retry ) {

        const videoRequest = fetch(`assets/${month}/${filename}`).then(response => response.blob());
        videoRequest.then(blob => {

            const reader = new FileReader();
            reader.addEventListener('loadend', (e) => {

                this.videoBlobs[`${month}/${filename}`] = {
                    buffer: reader.result,
                    video: video
                }

                resolve()
            });
            reader.addEventListener('error', error => { console.log(error) });
            reader.readAsArrayBuffer( blob );

            
            
            // const transaction = this.db.transaction(['videos']);
            // const objectStore = transaction.objectStore('videos');

            // const test = objectStore.get( filename );

            // test.onerror = event => {
            //     console.log('error');
            // };

            // test.onsuccess = event => {
            //     video.src = window.URL.createObjectURL(test.result.blob);
            // };

            // objectStore.transaction.oncomplete = event => {
            //     console.log(event)
            //     const videoObjectStore = db.transaction('videos', 'readwrite').objectStore('videos');
            //     videoObjectStore.add({name: filename, blob: blob});
            // };
        });

        // if( retry ) video.load()

        // if( !this.isMobile) video.oncanplaythrough = () => this.createVideoTexture( video, month, filename, resolve )
        // else {

        //     video.onloadeddata = () => {
        //         console.log( 'onloaded', video.src, video.error )
        //         video.onerror = null
        //         this.createVideoTexture( video, month, filename, resolve )
        //     }

        //     video.onerror = () => {
        //         console.log( 'onerror', video.src, video.error )
        //         video.onloadeddata = null
        //         this.videoPromise( video, month, filename, resolve, true )
        //     }

        // }

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
            this.assets.textures[ month ][ filename ] = texture
        
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
            this.assets.textures[ month ][ filename ] = texture

        }

    }

    createVideoTexture( video, month, filename, resolve, reject ) {

        let texture = new THREE.VideoTexture( video )
        texture.minFilter = texture.magFilter = THREE.LinearFilter
        texture.name = `${month}/${filename}`
        texture.mediaType = 'video'
        texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy()

        // if preloaded
        if( resolve ) {

            texture.size = new THREE.Vector2( texture.image.videoWidth / 2, texture.image.videoHeight / 2 )
            this.renderer.setTexture2D( texture, 0 )

            if( !this.isMobile) {
                video.oncanplaythrough = null
            } else {
                video.src = ''
                video.load()
                video.onloadeddata = null
            }

            resolve( texture )

        } else {

            texture.size = new THREE.Vector2( 1, 1 )

            video.oncanplaythrough = () => {
                texture.size = new THREE.Vector2( texture.image.videoWidth / 2, texture.image.videoHeight / 2 )
                texture.needsUpdate = true
                video.oncanplaythrough = null
            }

        }

        if( !this.assets.textures[ month ] ) this.assets.textures[ month ] = {}
        this.assets.textures[ month ][ filename ] = texture

    }

}