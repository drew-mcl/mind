import type { NodeTypes } from "@xyflow/react";
import { RootNode } from "./RootNode";
import { DomainNode } from "./DomainNode";
import { TaskNode } from "./TaskNode";

export const nodeTypes: NodeTypes = {
  root: RootNode,
  domain: DomainNode,
  feature: TaskNode,
  task: TaskNode,
};
