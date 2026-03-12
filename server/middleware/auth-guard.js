export function authGuard(request, reply, done) {
  if (!request.user?.id) {
    reply.code(401).send({ error: 'Not authenticated' });
    return;
  }
  done();
}

export function activeGuard(request, reply, done) {
  if (!request.user?.id) {
    reply.code(401).send({ error: 'Not authenticated' });
    return;
  }
  if (request.user.status === 'waitlist') {
    reply.code(403).send({ error: 'waitlist' });
    return;
  }
  done();
}

export function registeredGuard(request, reply, done) {
  if (!request.user?.id) {
    reply.code(403).send({ error: 'Registrati per salvare i profili' });
    return;
  }
  done();
}

export function adminGuard(request, reply, done) {
  if (!request.user?.id || request.user.role !== 'admin') {
    reply.code(403).send({ error: 'Admin access required' });
    return;
  }
  done();
}
