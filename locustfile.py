import time
import random
import socketio
import gevent
from gevent.event import Event
from locust import User, task, between, events

class SocketIOClient:
    """
    Socket.io client wrapper for Locust.
    Handles connection, event listeners, and tracking of request/response loops.
    """
    def __init__(self, host, environment):
        self.sio = socketio.Client(logger=False, engineio_logger=False)
        self.host = host
        self.environment = environment
        
        # Events to block and wait for response
        self.events = {
            "vote-success": Event(),
            "ranking-data": Event()
        }
        self.response_data = {}

        # Set up listeners
        self._register_handlers()

    def _register_handlers(self):
        @self.sio.on('connect')
        def on_connect():
            pass

        @self.sio.on('disconnect')
        def on_disconnect():
            pass

        @self.sio.on('vote-success')
        def on_vote_success(data):
            self.response_data['vote-success'] = data
            self.events['vote-success'].set()

        @self.sio.on('ranking-data')
        def on_ranking_data(data):
            self.response_data['ranking-data'] = data
            self.events['ranking-data'].set()

        @self.sio.on('sync-state')
        def on_sync_state(data):
            # Broadcast event received
            self.environment.events.request.fire(
                request_type="Socket.io-Broadcast",
                name="sync-state",
                response_time=0,
                response_length=len(str(data)),
                exception=None
            )

        @self.sio.on('vote-count-update')
        def on_vote_count_update(data):
            # Broadcast event received
            self.environment.events.request.fire(
                request_type="Socket.io-Broadcast",
                name="vote-count-update",
                response_time=0,
                response_length=len(str(data)),
                exception=None
            )

        @self.sio.on('results-broadcast')
        def on_results_broadcast(data):
            # Broadcast event received
            self.environment.events.request.fire(
                request_type="Socket.io-Broadcast",
                name="results-broadcast",
                response_time=0,
                response_length=len(str(data)),
                exception=None
            )

    def connect(self):
        start_time = time.time()
        try:
            self.sio.connect(self.host)
            duration = int((time.time() - start_time) * 1000)
            self.environment.events.request.fire(
                request_type="Socket.io-Sys",
                name="connect",
                response_time=duration,
                response_length=0,
                exception=None
            )
        except Exception as e:
            duration = int((time.time() - start_time) * 1000)
            self.environment.events.request.fire(
                request_type="Socket.io-Sys",
                name="connect",
                response_time=duration,
                response_length=0,
                exception=e
            )
            raise e

    def disconnect(self):
        if self.sio.connected:
            self.sio.disconnect()

    def emit_and_wait(self, emit_event, payload, response_event, timeout=5.0):
        """
        Emits an event and blocks the current gevent greenlet until the matching response event is received.
        """
        if not self.sio.connected:
            return None

        # Reset the event
        self.events[response_event].clear()
        
        start_time = time.time()
        try:
            if payload is not None:
                self.sio.emit(emit_event, payload)
            else:
                self.sio.emit(emit_event)
        except Exception as e:
            duration = int((time.time() - start_time) * 1000)
            self.environment.events.request.fire(
                request_type="Socket.io-Emit",
                name=f"{emit_event}_fail",
                response_time=duration,
                response_length=0,
                exception=e
            )
            return None

        # Block until event is set
        success = self.events[response_event].wait(timeout=timeout)
        duration = int((time.time() - start_time) * 1000)

        if success:
            data = self.response_data.get(response_event)
            self.environment.events.request.fire(
                request_type="Socket.io-Emit",
                name=emit_event,
                response_time=duration,
                response_length=len(str(data)) if data else 0,
                exception=None
            )
            return data
        else:
            self.environment.events.request.fire(
                request_type="Socket.io-Emit",
                name=emit_event,
                response_time=duration,
                response_length=0,
                exception=TimeoutError(f"Timed out waiting for {response_event}")
            )
            return None


class VoterUser(User):
    """
    Simulates a participant voting and viewing ranking.
    """
    weight = 5
    wait_time = between(2, 5)

    def on_start(self):
        self.client = SocketIOClient(self.host, self.environment)
        self.client.connect()
        # Generate a unique voter name
        self.voter_name = f"voter_{random.randint(1000, 9999)}_{self.client.sio.sid[:4] if self.client.sio.sid else ''}"

    def on_stop(self):
        self.client.disconnect()

    @task(3)
    def submit_vote(self):
        # Default options inside server.mjs
        options = ["ランナーA", "ランナーB", "ランナーC", "ランナーD", "ランナーE"]
        guesses = random.sample(options, 3)
        
        self.client.emit_and_wait(
            emit_event="submit-vote",
            payload={"name": self.voter_name, "guesses": guesses},
            response_event="vote-success"
        )

    @task(2)
    def get_ranking(self):
        self.client.emit_and_wait(
            emit_event="get-ranking",
            payload=None,
            response_event="ranking-data"
        )


class MonitorUser(User):
    """
    Simulates a big screen or background monitor.
    Only connects and listens to broadcast events without actively emitting queries.
    """
    weight = 1
    wait_time = between(5, 10)

    def on_start(self):
        self.client = SocketIOClient(self.host, self.environment)
        self.client.connect()

    def on_stop(self):
        self.client.disconnect()

    @task
    def idle(self):
        # Keep connection open and do nothing (handlers automatically record broadcast events)
        gevent.sleep(1)
