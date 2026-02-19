import type { NodeTypes } from "@xyflow/react";
import { RootNode } from "./RootNode";
import { DomainNode } from "./DomainNode";
import { GoalNode } from "./GoalNode";
import { TaskNode } from "./TaskNode";

export const nodeTypes: NodeTypes = {
  root: RootNode,
  domain: DomainNode,
  goal: GoalNode,
  feature: TaskNode,
  task: TaskNode,
};
