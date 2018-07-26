import { ActionFilter, ActionStreamItem } from "./types"

export const getActionFilter = (actionsOfType: ActionFilter) => {
  let predicate: ((asi: ActionStreamItem) => boolean)

  if (actionsOfType instanceof RegExp) {
    predicate = ({ action }: ActionStreamItem) => actionsOfType.test(action.type)
  } else if (actionsOfType instanceof Function) {
    predicate = actionsOfType
  } else {
    predicate = ({ action }: ActionStreamItem) => actionsOfType === action.type
  }
  return predicate
}
