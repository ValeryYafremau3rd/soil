import { CONTENT } from './catalogue'
import type { TaskboardConfiguration } from './types'

export const TASKBOARD_CONFIG = CONTENT.data.taskboards as TaskboardConfiguration
export const TASKBOARD_TYPES = TASKBOARD_CONFIG.types
export const TASKBOARD_PLACEMENTS = TASKBOARD_CONFIG.placements.filter(placement => placement.enabled !== false)
