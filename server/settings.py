
from silky import Dirs
import json


class Settings:

    settings = None

    @staticmethod
    def retrieve(group_name=None):
        if Settings.settings is None:
            path = Dirs.appDataDir() + '/settings.json'
            Settings.settings = Settings(path)

        if group_name is None:
            return Settings.settings
        else:
            return Settings(parent=Settings.settings, name=group_name)

    def __init__(self, path=None, parent=None, name=None):
        self._path = path
        self._parent = parent
        self._name = name

        if path is not None:
            try:
                with open(self._path, 'r') as file:
                    self._root = json.load(file)
                    if type(self._root) is not dict:
                        self._root = { }
            except:
                self._root = { }

        elif parent is not None and name is not None:
            self._root = parent._root.get(name, { })

        else:
            raise ValueError

    def set(self, name, value):
        self._root[name] = value
        if self._parent is not None:
            self._parent.set(self._name, self._root)

    def get(self, name, default=None):
        return self._root.get(name, default)

    def sync(self):
        if self._parent is not None:
            self._parent.sync()
        else:
            with open(self._path, 'w') as file:
                json.dump(self._root, file)
