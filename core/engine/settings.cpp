//
// Copyright (C) 2016 Jonathon Love
//

#include "settings.h"

using namespace std;
using namespace boost;

Settings *Settings::_settings = NULL;

string Settings::get(const string &key, const string &defaul)
{
    if (_settings == NULL)
        _settings = new Settings();

    return _settings->_pt.get(key, defaul);
}

Settings::Settings()
{
    filesystem::path path = Dirs2::exePath();
    string filename = path.stem().generic_string() + ".conf";
    path = path.parent_path() / filename;
    try
    {
        property_tree::read_ini(path.generic_string(), _pt);
    }
    catch (...)
    {
        // do nothing
    }
}


