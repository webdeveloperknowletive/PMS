import { createCrudApi } from "./crud-factory";
import type { Workflow, WorkflowCreate, WorkflowUpdate } from "@/types/workflow";

export const workflowApi = createCrudApi<Workflow, WorkflowCreate, WorkflowUpdate>("/workflows", "workflow_id");
