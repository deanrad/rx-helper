import { ActionFilter, ActionStreamItem } from "./types";
export declare const getActionFilter: (actionsOfType: ActionFilter) => (asi: ActionStreamItem) => boolean;
