/** Maps a Postgres error code raised by the provisioning RPCs to an HTTP status and error key. */
export function rpcError(code: string | undefined): { status: number; error: string } {
  switch (code) {
    case '23505':
      return { status: 409, error: 'code_taken' };
    case '23514':
      return { status: 409, error: 'household_full_or_inactive' };
    case '42501':
      return { status: 403, error: 'not_allowed' };
    case '22023':
      return { status: 400, error: 'invalid_code' };
    case 'P0002':
      return { status: 404, error: 'not_found' };
    default:
      return { status: 500, error: 'create_failed' };
  }
}
