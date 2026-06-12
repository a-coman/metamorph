-- AlterTable
ALTER TABLE "llm_calls"
ADD COLUMN "response_json" JSONB;

-- AlterTable
ALTER TABLE "exploration_checkpoints"
ADD COLUMN "llm_call_id" UUID;

-- AddForeignKey
ALTER TABLE "exploration_checkpoints" ADD CONSTRAINT "exploration_checkpoints_llm_call_id_fkey" FOREIGN KEY ("llm_call_id") REFERENCES "llm_calls" ("id") ON DELETE SET NULL ON UPDATE CASCADE;