
"""
Stage Pi: Open source stagebox software

Copyright (C) 2025 Bama Box ltd.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, version 3 of the License.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.
"""
# core/stream_manager.py
import os
import json
import uuid
import logging
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)

# Map provider name -> JSON config path.
_provider_config_map = {
    'aes67': '/usr/local/stagepi/etc/aes67.json',
}


def _provider_json_path(provider: str) -> str:
    """Return the configured JSON path for the provider."""
    return _provider_config_map.get(provider, f"/usr/local/stagepi/etc/{provider}.json")


def read_streams(provider: str = 'aes67') -> Dict[str, List[Dict[str, Any]]]:
    """
    Read stream configuration from the provider's JSON file.

    Args:
        provider: The stream provider name (default: 'aes67')

    Returns:
        Dictionary with 'streams' key containing list of stream configurations
    """
    logger.info(f"CORE: Reading streams for provider '{provider}'...")
    path = _provider_json_path(provider)
    if os.path.exists(path):
        try:
            with open(path, 'r') as jf:
                data = json.load(jf)
                data.setdefault('streams', [])
                # Ensure each stream has an 'enabled' field (default True)
                for s in data['streams']:
                    if 'enabled' not in s:
                        s['enabled'] = True
                return data
        except Exception as e:
            logger.error(f"Error reading stream config from {path}: {e}")
            # On error, return empty streams to avoid crashing the API.
            return {'streams': []}
    return {'streams': []}


def write_streams(streams: List[Dict[str, Any]], provider: str = 'aes67') -> None:
    """
    Write stream configuration to the provider's JSON file.

    Args:
        streams: List of stream configurations to write
        provider: The stream provider name (default: 'aes67')
    """
    logger.info(f"CORE: Writing {len(streams)} streams for provider '{provider}'...")
    path = _provider_json_path(provider)
    os.makedirs(os.path.dirname(path), exist_ok=True)

    # Normalize streams to include 'enabled' default True and generate id
    for i, s in enumerate(streams):
        if 'enabled' not in s:
            s['enabled'] = True
        # ensure id
        if not s.get('id'):
            s['id'] = f"s-{uuid.uuid4().hex[:8]}"

    to_write = {'streams': streams}
    with open(path, 'w') as jf:
        json.dump(to_write, jf, indent=2)
    logger.info(f"CORE: Successfully wrote streams to {path}")


def get_all_streams(provider: str = 'aes67') -> List[Dict[str, Any]]:
    """
    Get all streams for a provider.

    Args:
        provider: The stream provider name (default: 'aes67')

    Returns:
        List of stream configurations
    """
    cfg = read_streams(provider)
    return cfg.get('streams', [])


def get_stream_by_id(stream_id: str, provider: str = 'aes67') -> Optional[Dict[str, Any]]:
    """
    Get a specific stream by ID.

    Args:
        stream_id: The stream ID to find
        provider: The stream provider name (default: 'aes67')

    Returns:
        Stream configuration dict or None if not found
    """
    logger.info(f"CORE: Getting stream '{stream_id}' for provider '{provider}'...")
    streams = get_all_streams(provider)
    for i, s in enumerate(streams):
        if str(s.get('id', i)) == str(stream_id) or str(i) == str(stream_id):
            return s
    return None


def add_stream(stream_data: Dict[str, Any], provider: str = 'aes67') -> List[Dict[str, Any]]:
    """
    Add a new stream to the configuration.

    Args:
        stream_data: Stream configuration to add
        provider: The stream provider name (default: 'aes67')

    Returns:
        Updated list of all streams
    """
    logger.info(f"CORE: Adding new stream for provider '{provider}'...")
    streams = get_all_streams(provider)

    # Set defaults
    if 'enabled' not in stream_data:
        stream_data['enabled'] = True
    if not stream_data.get('id'):
        stream_data['id'] = f"s-{uuid.uuid4().hex[:8]}"

    streams.append(stream_data)
    write_streams(streams, provider)
    return streams


def update_stream(stream_id: str, stream_update: Dict[str, Any], provider: str = 'aes67') -> List[Dict[str, Any]]:
    """
    Update an existing stream by ID.

    Args:
        stream_id: The stream ID to update
        stream_update: Partial or complete stream configuration to merge
        provider: The stream provider name (default: 'aes67')

    Returns:
        Updated list of all streams

    Raises:
        ValueError: If stream_id is not found
    """
    logger.info(f"CORE: Updating stream '{stream_id}' for provider '{provider}'...")
    streams = get_all_streams(provider)
    found = False

    for i, s in enumerate(streams):
        if str(s.get('id', i)) == str(stream_id) or str(i) == str(stream_id):
            merged = {**s, **stream_update}
            if 'enabled' not in merged:
                merged['enabled'] = True
            # ensure id remains present
            if not merged.get('id'):
                merged['id'] = s.get('id') or f"s-{uuid.uuid4().hex[:8]}"
            streams[i] = merged
            found = True
            break

    if not found:
        raise ValueError(f"Stream {stream_id} not found")

    write_streams(streams, provider)
    return streams


def delete_stream(stream_id: str, provider: str = 'aes67') -> List[Dict[str, Any]]:
    """
    Delete a stream by ID.

    Args:
        stream_id: The stream ID to delete
        provider: The stream provider name (default: 'aes67')

    Returns:
        Updated list of remaining streams

    Raises:
        ValueError: If stream_id is not found
    """
    logger.info(f"CORE: Deleting stream '{stream_id}' for provider '{provider}'...")
    streams = get_all_streams(provider)
    new_streams = []
    found = False

    for i, s in enumerate(streams):
        if str(s.get('id', i)) == str(stream_id) or str(i) == str(stream_id):
            found = True
            continue
        new_streams.append(s)

    if not found:
        raise ValueError(f"Stream {stream_id} not found")

    write_streams(new_streams, provider)
    return new_streams


def replace_all_streams(streams: List[Dict[str, Any]], provider: str = 'aes67') -> List[Dict[str, Any]]:
    """
    Replace all streams with a new list.

    Args:
        streams: New list of stream configurations
        provider: The stream provider name (default: 'aes67')

    Returns:
        The new list of streams (after normalization)
    """
    logger.info(f"CORE: Replacing all streams for provider '{provider}' with {len(streams)} new streams...")
    # Ensure enabled and generate id for each stream
    for s in streams:
        if 'enabled' not in s:
            s['enabled'] = True
        if not s.get('id'):
            s['id'] = f"s-{uuid.uuid4().hex[:8]}"

    write_streams(streams, provider)
    return streams
