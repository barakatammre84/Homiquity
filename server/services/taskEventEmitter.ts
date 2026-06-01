/**
 * Task Event Emitter Service
 * 
 * Provides event hooks for Document Intelligence and Workflow State Changes
 * to automatically create tasks via the Task Engine.
 * 
 * Events are idempotent - duplicate events with the same key won't create duplicate tasks.
 */

import { taskEngine } from "./taskEngine";
import type { InsertTaskEvent } from "@shared/schema";

export type DocumentEventType = 
  | "DOCUMENT_UPLOADED"
  | "DOCUMENT_EXTRACTED"
  | "DOCUMENT_EXTRACTION_FAILED"
  | "DOCUMENT_OCR_ISSUE"
  | "DOCUMENT_EXPIRED"
  | "DOCUMENT_MISSING";

export type WorkflowEventType =
  | "APPLICATION_SUBMITTED"
  | "APPLICATION_PRE_APPROVED"
  | "APPLICATION_DENIED"
  | "STAGE_ADVANCED"
  | "STAGE_DOC_COLLECTION"
  | "STAGE_PROCESSING"
  | "STAGE_UNDERWRITING"
  | "STAGE_CONDITIONAL"
  | "STAGE_CLEAR_TO_CLOSE"
  | "STAGE_CLOSING"
  | "STAGE_FUNDED";

export type CreditEventType =
  | "CREDIT_SCORE_DROPPED"
  | "NEW_TRADELINE_DETECTED"
  | "CREDIT_EXPIRED";

export type IncomeEventType =
  | "INCOME_CHANGE_DETECTED"
  | "EMPLOYMENT_VERIFICATION_NEEDED"
  | "INCOME_EXPIRED";

export type AssetEventType =
  | "ASSET_DECREASE_DETECTED"
  | "ASSET_VERIFICATION_NEEDED";

interface BaseEventPayload {
  applicationId: string;
  triggeredBy?: string;
  metadata?: Record<string, unknown>;
}

interface DocumentEventPayload extends BaseEventPayload {
  documentId?: string;
  documentType?: string;
  errorMessage?: string;
}

interface WorkflowEventPayload extends BaseEventPayload {
  previousStage?: string;
  newStage?: string;
}

interface CreditEventPayload extends BaseEventPayload {
  previousScore?: number;
  newScore?: number;
  tradelineDetails?: string;
}

interface IncomeEventPayload extends BaseEventPayload {
  previousIncome?: number;
  newIncome?: number;
  employerId?: string;
}

interface AssetEventPayload extends BaseEventPayload {
  previousAmount?: number;
  newAmount?: number;
  accountId?: string;
}

class TaskEventEmitter {
  
  /**
   * Emit a document-related event
   */
  async emitDocumentEvent(
    eventType: DocumentEventType,
    payload: DocumentEventPayload
  ): Promise<void> {
    const { applicationId, documentId, documentType, errorMessage, triggeredBy, metadata } = payload;
    
    // Create idempotency key to prevent duplicate tasks
    const idempotencyKey = `doc_${eventType}_${applicationId}_${documentId || Date.now()}`;
    
    // Map event type to task type code and title
    const taskMapping = this.getDocumentTaskMapping(eventType, documentType);
    if (!taskMapping) return;
    
    const event: InsertTaskEvent = {
      eventType,
      eventSource: "DOCUMENT_INTELLIGENCE",
      applicationId,
      idempotencyKey,
      eventPayload: {
        title: taskMapping.title,
        description: taskMapping.description || errorMessage,
        taskType: "document_request",
        taskTypeCode: taskMapping.taskTypeCode,
        documentId,
        documentType,
        errorMessage,
        ...metadata,
      },
    };
    
    const result = await taskEngine.createTaskFromEvent(event);
    
    console.log(`[TaskEventEmitter] Document event ${eventType} processed`, {
      applicationId,
      documentId,
      taskCreated: !!result.task,
    });
  }
  
  /**
   * Emit a workflow state change event
   */
  async emitWorkflowEvent(
    eventType: WorkflowEventType,
    payload: WorkflowEventPayload
  ): Promise<void> {
    const { applicationId, previousStage, newStage, triggeredBy, metadata } = payload;
    
    // Create idempotency key
    const idempotencyKey = `workflow_${eventType}_${applicationId}_${newStage || Date.now()}`;
    
    // Map event type to task type code
    const taskMapping = this.getWorkflowTaskMapping(eventType, newStage);
    if (!taskMapping) return;
    
    const event: InsertTaskEvent = {
      eventType,
      eventSource: "WORKFLOW_STATE",
      applicationId,
      idempotencyKey,
      eventPayload: {
        title: taskMapping.title,
        description: taskMapping.description,
        taskType: taskMapping.taskType,
        taskTypeCode: taskMapping.taskTypeCode,
        previousStage,
        newStage,
        ...metadata,
      },
    };
    
    const result = await taskEngine.createTaskFromEvent(event);
    
    console.log(`[TaskEventEmitter] Workflow event ${eventType} processed`, {
      applicationId,
      newStage,
      taskCreated: !!result.task,
    });
  }
  
  /**
   * Emit a credit-related event (Change of Circumstance)
   */
  async emitCreditEvent(
    eventType: CreditEventType,
    payload: CreditEventPayload
  ): Promise<void> {
    const { applicationId, previousScore, newScore, tradelineDetails, triggeredBy, metadata } = payload;
    
    const idempotencyKey = `credit_${eventType}_${applicationId}_${Date.now()}`;
    
    const taskMapping = this.getCreditTaskMapping(eventType);
    if (!taskMapping) return;
    
    const event: InsertTaskEvent = {
      eventType,
      eventSource: "CREDIT_MONITORING",
      applicationId,
      idempotencyKey,
      eventPayload: {
        title: taskMapping.title,
        description: `Previous: ${previousScore}, New: ${newScore}. ${tradelineDetails || ''}`,
        taskType: "review",
        taskTypeCode: taskMapping.taskTypeCode,
        previousScore,
        newScore,
        tradelineDetails,
        ...metadata,
      },
    };
    
    const result = await taskEngine.createTaskFromEvent(event);
    
    console.log(`[TaskEventEmitter] Credit event ${eventType} processed`, {
      applicationId,
      taskCreated: !!result.task,
    });
  }
  
  /**
   * Emit an income-related event
   */
  async emitIncomeEvent(
    eventType: IncomeEventType,
    payload: IncomeEventPayload
  ): Promise<void> {
    const { applicationId, previousIncome, newIncome, employerId, triggeredBy, metadata } = payload;
    
    const idempotencyKey = `income_${eventType}_${applicationId}_${Date.now()}`;
    
    const taskMapping = this.getIncomeTaskMapping(eventType);
    if (!taskMapping) return;
    
    const event: InsertTaskEvent = {
      eventType,
      eventSource: "INCOME_VERIFICATION",
      applicationId,
      idempotencyKey,
      eventPayload: {
        title: taskMapping.title,
        description: taskMapping.description,
        taskType: "verification",
        taskTypeCode: taskMapping.taskTypeCode,
        previousIncome,
        newIncome,
        employerId,
        ...metadata,
      },
    };
    
    const result = await taskEngine.createTaskFromEvent(event);
    
    console.log(`[TaskEventEmitter] Income event ${eventType} processed`, {
      applicationId,
      taskCreated: !!result.task,
    });
  }
  
  /**
   * Emit an asset-related event
   */
  async emitAssetEvent(
    eventType: AssetEventType,
    payload: AssetEventPayload
  ): Promise<void> {
    const { applicationId, previousAmount, newAmount, accountId, triggeredBy, metadata } = payload;
    
    const idempotencyKey = `asset_${eventType}_${applicationId}_${Date.now()}`;
    
    const taskMapping = this.getAssetTaskMapping(eventType);
    if (!taskMapping) return;
    
    const event: InsertTaskEvent = {
      eventType,
      eventSource: "ASSET_VERIFICATION",
      applicationId,
      idempotencyKey,
      eventPayload: {
        title: taskMapping.title,
        description: taskMapping.description,
        taskType: "verification",
        taskTypeCode: taskMapping.taskTypeCode,
        previousAmount,
        newAmount,
        accountId,
        ...metadata,
      },
    };
    
    const result = await taskEngine.createTaskFromEvent(event);
    
    console.log(`[TaskEventEmitter] Asset event ${eventType} processed`, {
      applicationId,
      taskCreated: !!result.task,
    });
  }
  
  // Task mapping helpers
  private getDocumentTaskMapping(eventType: DocumentEventType, documentType?: string): { title: string; description?: string; taskTypeCode: string } | null {
    const docLabel = documentType ? documentType.replace(/_/g, ' ') : 'document';
    
    switch (eventType) {
      case "DOCUMENT_UPLOADED":
        return {
          title: `Review uploaded ${docLabel}`,
          description: `New ${docLabel} uploaded - review for completeness`,
          taskTypeCode: "DOC_REVIEW",
        };
      case "DOCUMENT_EXTRACTED":
        return null; // Successful extraction doesn't need a task
      case "DOCUMENT_EXTRACTION_FAILED":
        return {
          title: `Document extraction failed - ${docLabel}`,
          description: `Automated extraction failed. Manual review required.`,
          taskTypeCode: "OCR_FAILED",
        };
      case "DOCUMENT_OCR_ISSUE":
        return {
          title: `OCR quality issue - ${docLabel}`,
          description: `Document may be unreadable or incomplete`,
          taskTypeCode: "OCR_QUALITY",
        };
      case "DOCUMENT_EXPIRED":
        return {
          title: `Document expired - ${docLabel}`,
          description: `Document has expired and needs to be refreshed`,
          taskTypeCode: "DOC_EXPIRED",
        };
      case "DOCUMENT_MISSING":
        return {
          title: `Missing required ${docLabel}`,
          description: `Required document has not been uploaded`,
          taskTypeCode: "DOC_MISSING",
        };
      default:
        return null;
    }
  }
  
  private getWorkflowTaskMapping(eventType: WorkflowEventType, newStage?: string): { title: string; description?: string; taskType: string; taskTypeCode: string } | null {
    switch (eventType) {
      case "APPLICATION_SUBMITTED":
        return {
          title: "Review new application",
          description: "New loan application submitted - initial review required",
          taskType: "review",
          taskTypeCode: "INTAKE_REVIEW",
        };
      case "APPLICATION_PRE_APPROVED":
        return {
          title: "Pre-approval confirmed - begin document collection",
          description: "Application pre-approved. Initiate document collection phase.",
          taskType: "review",
          taskTypeCode: "PA_GENERATE",
        };
      case "APPLICATION_DENIED":
        return {
          title: "Generate adverse action notice",
          description: "Application denied - prepare required adverse action notice",
          taskType: "compliance",
          taskTypeCode: "CMP_ADVERSE_ACTION",
        };
      case "STAGE_DOC_COLLECTION":
        return {
          title: "Document collection initiated",
          description: "Verify all required documents are requested",
          taskType: "document_request",
          taskTypeCode: "DOC_COLLECT_START",
        };
      case "STAGE_PROCESSING":
        return {
          title: "Begin loan processing",
          description: "Application ready for processing review",
          taskType: "review",
          taskTypeCode: "PROC_START",
        };
      case "STAGE_UNDERWRITING":
        return {
          title: "Begin underwriting review",
          description: "Application ready for underwriting decision",
          taskType: "decision",
          taskTypeCode: "UW_START",
        };
      case "STAGE_CONDITIONAL":
        return {
          title: "Clear pending conditions",
          description: "Conditional approval granted - clear remaining conditions",
          taskType: "condition",
          taskTypeCode: "ELIG_COND_CLEAR",
        };
      case "STAGE_CLEAR_TO_CLOSE":
        return {
          title: "Prepare closing documents",
          description: "Loan is clear to close - prepare closing package",
          taskType: "closing",
          taskTypeCode: "CMP_CLOSING_DISC",
        };
      case "STAGE_CLOSING":
        return {
          title: "Execute closing",
          description: "Closing scheduled - coordinate signing and funding",
          taskType: "closing",
          taskTypeCode: "CMP_CLOSING_DISC",
        };
      case "STAGE_FUNDED":
        return null; // No task needed after funding - loan is complete
      default:
        return null;
    }
  }
  
  private getCreditTaskMapping(eventType: CreditEventType): { title: string; taskTypeCode: string } | null {
    switch (eventType) {
      case "CREDIT_SCORE_DROPPED":
        return {
          title: "Credit score change detected - review eligibility",
          taskTypeCode: "CRD_SCORE_CHANGE",
        };
      case "NEW_TRADELINE_DETECTED":
        return {
          title: "New tradeline detected - investigate",
          taskTypeCode: "CRD_NEW_TRADELINE",
        };
      case "CREDIT_EXPIRED":
        return {
          title: "Credit report expired - re-pull required",
          taskTypeCode: "CRD_EXPIRED",
        };
      default:
        return null;
    }
  }
  
  private getIncomeTaskMapping(eventType: IncomeEventType): { title: string; description?: string; taskTypeCode: string } | null {
    switch (eventType) {
      case "INCOME_CHANGE_DETECTED":
        return {
          title: "Income change detected - review eligibility",
          description: "Income has changed since initial qualification",
          taskTypeCode: "INC_CHANGE",
        };
      case "EMPLOYMENT_VERIFICATION_NEEDED":
        return {
          title: "Employment verification required",
          description: "Verify current employment status",
          taskTypeCode: "INC_VERIFY_EMP",
        };
      case "INCOME_EXPIRED":
        return {
          title: "Income documentation expired",
          description: "Income documents need to be refreshed",
          taskTypeCode: "INC_EXPIRED",
        };
      default:
        return null;
    }
  }
  
  private getAssetTaskMapping(eventType: AssetEventType): { title: string; description?: string; taskTypeCode: string } | null {
    switch (eventType) {
      case "ASSET_DECREASE_DETECTED":
        return {
          title: "Asset decrease detected - review funds",
          description: "Asset values have decreased since qualification",
          taskTypeCode: "AST_DECREASE",
        };
      case "ASSET_VERIFICATION_NEEDED":
        return {
          title: "Asset verification required",
          description: "Verify asset source and availability",
          taskTypeCode: "AST_VERIFY",
        };
      default:
        return null;
    }
  }
}

// Singleton instance
export const taskEventEmitter = new TaskEventEmitter();
