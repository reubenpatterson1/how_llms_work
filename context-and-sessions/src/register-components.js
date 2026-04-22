// This file is imported once (by main.jsx via App). As each interactive component
// is built, import it here and add it to registerComponent.
import { registerComponent } from './component-registry.js'
import AttentionBudgetAllocator from './components/AttentionBudgetAllocator.jsx'
import ContextSessionsAssessment from './components/ContextSessionsAssessment.jsx'
import ContextWindowPlayground from './components/ContextWindowPlayground.jsx'
import LeverComparisonTool from './components/LeverComparisonTool.jsx'
import LostInTheMiddleCurve from './components/LostInTheMiddleCurve.jsx'
import SessionHygieneSimulator from './components/SessionHygieneSimulator.jsx'

registerComponent('AttentionBudgetAllocator', AttentionBudgetAllocator)
registerComponent('ContextSessionsAssessment', ContextSessionsAssessment)
registerComponent('ContextWindowPlayground', ContextWindowPlayground)
registerComponent('LeverComparisonTool', LeverComparisonTool)
registerComponent('LostInTheMiddleCurve', LostInTheMiddleCurve)
registerComponent('SessionHygieneSimulator', SessionHygieneSimulator)
