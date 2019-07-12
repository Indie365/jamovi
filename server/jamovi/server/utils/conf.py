
import sys
import re
from os import path
from os import environ
from configparser import ConfigParser
import platform

config_values = None


def set(key, value):
    global config_values
    init()
    config_values[key] = value


def get(key, otherwise=None):
    global config_values
    init()
    return config_values.get(key, otherwise)


def init(app_home=None):
    global config_values

    if config_values is None:

        config_values = { 'debug': False }

        if app_home is not None:
            root = app_home
        if 'JAMOVI_HOME' in environ:
            root = path.abspath(environ['JAMOVI_HOME'])
        else:
            root = path.realpath(path.join(path.dirname(sys.executable), '..'))

        if platform.system() == 'Darwin':
            ini_path = path.join(root, 'Resources', 'env.conf')
        else:
            ini_path = path.join(root, 'bin', 'env.conf')

        config = ConfigParser()
        config.read(ini_path)

        for k in environ:
            if k.startswith('JAMOVI_'):
                config_values[k[7:].lower()] = environ[k]

        config_values['home'] = root

        try:
            app_config = config['ENV']
            for k in app_config:
                value = app_config[k]
                if k.startswith('jamovi_'):
                    k = k[7:]
                if k.endswith('path') or k.endswith('home') or k.endswith('libs'):
                    if value != '':
                        parts = re.split('[:;]', value)
                        parts = map(lambda x: path.normpath(path.join(root, 'bin', x)), parts)
                        value = path.pathsep.join(parts)
                config_values[k] = value
        except KeyError:
            pass

        try:
            app_config = config['APP']
            if app_config is not None:
                for k in app_config:
                    value = app_config[k]
                    config_values[k] = value
        except KeyError:
            pass
