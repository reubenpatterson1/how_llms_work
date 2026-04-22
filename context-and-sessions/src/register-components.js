// This file is imported once (by main.jsx via App). As each interactive component
// is built, import it here and add it to registerComponent.
import { registerComponent } from './component-registry.js'
import AttentionBudgetAllocator from './components/AttentionBudgetAllocator.jsx'
import ContextWindowPlayground from './components/ContextWindowPlayground.jsx'

registerComponent('AttentionBudgetAllocator', AttentionBudgetAllocator)
registerComponent('ContextWindowPlayground', ContextWindowPlayground)
