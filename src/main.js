import './scss/style.scss'
import Timeline from './components/Timeline'

// Initial HMR Setup
if (module.hot) {
    module.hot.accept()

    module.hot.dispose(() => {
        window.assets = timeline.assets
        timeline.renderer.domElement.removeEventListener('wheel', timeline.scroll)
        timeline.renderer.domElement.removeEventListener('resize', timeline.resize)
        timeline.renderer.domElement.removeEventListener('mousedown', timeline.mouseDown)
        timeline.renderer.domElement.removeEventListener('mouseup', timeline.mouseUp)
        document.querySelector('canvas').remove()
        timeline.renderer.forceContextLoss()
        timeline.renderer.context = null
        timeline.renderer.domElement = null
        timeline.renderer = null
        cancelAnimationFrame(timeline.animationId)
        removeEventListener('mousemove', timeline.mouseMove)

        timeline.gesture.destroy()
    })
}



const timeline = new Timeline()
window.timeline = timeline