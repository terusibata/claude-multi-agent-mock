/**
 * 統一エラーレスポンス生成ヘルパー
 *
 * 本家 (Python/FastAPI) の create_error_response() と完全に同じフィールド構成を返す。
 * Pydantic model_dump() は全フィールドを常に含むため、details / request_id が
 * 不要な場合でも null として出力される。
 */

/**
 * @param {object} req - Express request (x-request-id ヘッダー取得用)
 * @param {string} code - エラーコード (NOT_FOUND, VALIDATION_ERROR, CONFLICT, FORBIDDEN, etc.)
 * @param {string} message - ユーザー向けメッセージ
 * @param {Array|null} [details=null] - エラー詳細配列 (バリデーションエラー時のみ)
 * @returns {object} { error: { code, message, details, request_id, timestamp } }
 */
function createErrorResponse(req, code, message, details = null) {
  return {
    error: {
      code,
      message,
      details,
      request_id: req.headers['x-request-id'] || null,
      timestamp: new Date().toISOString(),
    },
  };
}

module.exports = { createErrorResponse };
