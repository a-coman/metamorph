-- AlterTable
ALTER TABLE "llm_calls"
ADD COLUMN "system_prompt" TEXT,
ADD COLUMN "user_prompt" TEXT,
ADD COLUMN "user_prompt_images" JSONB;