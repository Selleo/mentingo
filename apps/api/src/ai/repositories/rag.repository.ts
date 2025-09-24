import { Inject, Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { ceil } from "lodash";

import { SIMILARITY_THRESHOLD } from "src/ai/ai.constants";
import { DatabasePg } from "src/common";
import {
  aiMentorLessons,
  docChunks,
  documents,
  documentToAiMentorLesson,
} from "src/storage/schema";

import type { UUIDType } from "src/common";

@Injectable()
export class RagRepository {
  constructor(@Inject("DB") private readonly db: DatabasePg) {}

  async findTopKDocumentChunksWithNeighboursForAiMentorLesson(
    lessonId: UUIDType,
    embedding: number[],
    topK: number,
    neighbourCount: number,
  ) {
    const neighbourRadius = ceil(neighbourCount / 2);

    return this.db.execute(sql`
      WITH top_chunks AS (
        SELECT 
          ${docChunks.id},
          ${docChunks.documentId},
          ${docChunks.chunkIndex},
          ${docChunks.content},
          ${docChunks.embedding},
          1 - (${docChunks.embedding} <=> ${JSON.stringify(embedding)}::vector) as similarity_score
        FROM ${docChunks}
        INNER JOIN ${documents} ON ${docChunks.documentId} = ${documents.id}
        INNER JOIN ${documentToAiMentorLesson} ON ${documentToAiMentorLesson.documentId} = ${
          documents.id
        }
        INNER JOIN ${aiMentorLessons} ON ${aiMentorLessons.id} = ${
          documentToAiMentorLesson.aiMentorLessonId
        }
        WHERE 
          ${aiMentorLessons.lessonId} = ${lessonId}
          AND 1 - (${docChunks.embedding} <=> ${JSON.stringify(
            embedding,
          )}::vector) > ${SIMILARITY_THRESHOLD}
        ORDER BY similarity_score DESC
        LIMIT ${topK}
      ),
      chunks_with_neighbours AS (
        SELECT DISTINCT
          dc.id,
          dc.document_id,
          dc.chunk_index,
          dc.content,
          dc.embedding,
          CASE 
            WHEN tc.id IS NOT NULL THEN tc.similarity_score
            ELSE 0
          END as similarity_score,
          CASE 
            WHEN tc.id IS NOT NULL THEN true
            ELSE false
          END as is_top_chunk
        FROM top_chunks tc
        INNER JOIN ${docChunks} dc ON dc.document_id = tc.document_id
        WHERE dc.chunk_index BETWEEN tc.chunk_index - ${neighbourRadius} AND tc.chunk_index + ${neighbourRadius}
        
        UNION
        
        SELECT 
          id,
          document_id,
          chunk_index,
          content,
          embedding,
          similarity_score,
          true as is_top_chunk
        FROM top_chunks
      )
      SELECT * FROM chunks_with_neighbours
      ORDER BY similarity_score DESC, document_id, chunk_index
    `);
  }
}
