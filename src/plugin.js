import { applyTransform } from './transform'

const tan30 = Math.tan(Math.PI / 6)

export function onCreateTop(context) {
    applyTransform(context.selection, 45, 1, tan30, 0)
}

export function onCreateLeft(context) {
    applyTransform(context.selection, -45, tan30, 1, 30)
}

export function onCreateFront(context) {
    applyTransform(context.selection, 45, tan30, 1, -30)
}
