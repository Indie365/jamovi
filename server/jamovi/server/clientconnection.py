#
# Copyright (C) 2016 Jonathon Love
#

from .session import NoSuchInstanceException

from tornado.websocket import WebSocketHandler

from . import jamovi_pb2 as jcoms
import asyncio

import logging

log = logging.getLogger(__name__)


class ClientConnection(WebSocketHandler):

    number_of_connections = 0

    def initialize(self, session):

        self._session = session
        self._transactions = { }
        self._close_listeners = [ ]
        self._instance_id = None

    def check_origin(self, origin):
        return True

    def open(self, instance_id):
        self._instance_id = instance_id
        ClientConnection.number_of_connections += 1
        self.set_nodelay(True)

    def on_close(self):
        ClientConnection.number_of_connections -= 1
        for listener in self._close_listeners:
            listener()

    def on_message(self, m_bytes):
        asyncio.ensure_future(self.on_message_async(m_bytes))

    async def on_message_async(self, m_bytes):
        try:
            message = jcoms.ComsMessage()
            message.ParseFromString(m_bytes)
            if not message.payloadType:
                # should log bad request
                return
            clas = getattr(jcoms, message.payloadType)
            request = clas()
            request.ParseFromString(message.payload)
            self._transactions[message.id] = request

            if type(request) == jcoms.InstanceRequest:
                if message.instanceId == '':
                    instance = self._session.create()  # create new
                elif message.instanceId not in self._session:
                    raise NoSuchInstanceException()
                else:
                    instance = self._session[message.instanceId]
                instance.set_coms(self)
                response = jcoms.InstanceResponse()
                response.instanceId = instance.id
                self.send(response, instance.id, request)
            else:
                instance = self._session[message.instanceId]
                await instance.on_request(request)
        except NoSuchInstanceException:
            self.send_error(
                message='No such instance',
                instance_id=message.instanceId,
                response_to=request)
        except Exception as e:
            # would be nice to send_error()
            log.exception(e)

    def send(self, message=None, instance_id=None, response_to=None, complete=True, progress=(0, 0)):

        if message is None and response_to is None:
            return

        m = jcoms.ComsMessage()

        if instance_id is not None:
            m.instanceId = instance_id

        if response_to is not None:
            for key, value in self._transactions.items():
                if value is response_to:
                    m.id = key
                    if complete:
                        del self._transactions[key]
                    break
        else:
            m.id = 0

        if message is not None:
            m.payload = message.SerializeToString()
            m.payloadType = message.__class__.__name__

        if complete:
            m.status = jcoms.Status.Value('COMPLETE')
        else:
            m.status = jcoms.Status.Value('IN_PROGRESS')

        m.progress = int(progress[0])
        m.progressTotal = int(progress[1])

        self.write_message(m.SerializeToString(), binary=True)

    def send_error(self, message=None, cause=None, instance_id=None, response_to=None):

        m = jcoms.ComsMessage()

        if instance_id is not None:
            m.instanceId = instance_id

        if response_to is not None:
            for key, value in self._transactions.items():
                if value is response_to:
                    m.id = key
                    del self._transactions[key]
                    break
        else:
            m.id = 0

        if message is not None:
            m.error.message = message

        if cause is not None:
            m.error.cause = cause

        m.status = jcoms.Status.Value('ERROR')

        self.write_message(m.SerializeToString(), binary=True)

    def add_close_listener(self, listener):
        self._close_listeners.append(listener)

    def remove_close_listener(self, listener):
        self._close_listeners.remove(listener)

    def discard(self, message):
        for key, value in self._transactions.items():
            if value is message:
                del self._transactions[key]
                break
