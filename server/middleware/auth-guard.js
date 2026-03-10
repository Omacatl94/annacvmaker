export function authGuard(request, reply, done) {
  if (!request.session?.userId) {
    reply.code(401).send({ error: 'Not authenticated' });
    return;
  }
  done();
}
