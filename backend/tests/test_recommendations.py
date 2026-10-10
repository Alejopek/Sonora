import unittest

from app.services.listening import early_skip, meaningful_play, progress_delta
from app.services.recommendations import rank_and_diversify
from app.main import app
from app.routes.insights import _range_dates


def candidate(id, artist, album, genre):
    return {'id': id, 'title': id, 'artist': artist, 'album': album, 'genres': [genre], 'thumbnail': ''}


class ListeningSignalTests(unittest.TestCase):
    def test_progress_only_accepts_new_real_listening(self):
        self.assertEqual(progress_delta(18, 10), 8)
        self.assertEqual(progress_delta(3, 10), 0)
        self.assertEqual(progress_delta(600, 0), 120)

    def test_completion_threshold_and_early_skip_are_distinct(self):
        self.assertFalse(meaningful_play(9, 180))
        self.assertTrue(meaningful_play(30, 180))
        self.assertTrue(early_skip(7, 240))
        self.assertFalse(early_skip(20, 240))

    def test_statistics_periods_resolve_to_dates_without_shadowing_iteration(self):
        start, end, label = _range_dates('today', None, None)
        self.assertEqual(start, end)
        self.assertEqual(label, 'Hoy')
        start, end, label = _range_dates('30d', None, None)
        self.assertEqual((end - start).days, 29)
        self.assertEqual(label, 'Últimos 30 días')
        self.assertIsNone(_range_dates('all', None, None)[0])

    def test_statistics_query_parameter_remains_named_range(self):
        operation = app.openapi()['paths']['/api/statistics']['get']
        query_names = {parameter['name'] for parameter in operation['parameters'] if parameter['in'] == 'query'}
        self.assertIn('range', query_names)


class RecommendationRankingTests(unittest.TestCase):
    def test_ranking_prefers_affinity_but_avoids_adjacent_artist_and_genre(self):
        choices = [
            candidate('a', 'Artista A', 'Uno', 'indie'), candidate('b', 'Artista A', 'Dos', 'indie'),
            candidate('c', 'Artista B', 'Tres', 'electronic'), candidate('d', 'Artista C', 'Cuatro', 'jazz'),
        ]
        result = rank_and_diversify(choices, artist_scores={'artista a': 100}, genre_scores={}, track_scores={}, skipped_tracks=set(), excluded_tracks=set(), favorite_tracks=set(), limit=3)
        self.assertEqual(result[0]['id'], 'a')
        self.assertNotEqual(result[1]['artist'], 'Artista A')
        self.assertEqual(len({item['id'] for item in result}), 3)

    def test_excluded_and_heavily_skipped_candidates_do_not_win(self):
        choices = [candidate('keep', 'A', 'One', 'rock'), candidate('skip', 'B', 'Two', 'pop'), candidate('hide', 'C', 'Three', 'jazz')]
        result = rank_and_diversify(choices, artist_scores={}, genre_scores={}, track_scores={}, skipped_tracks={'skip'}, excluded_tracks={'hide'}, favorite_tracks=set(), limit=2)
        self.assertEqual(result[0]['id'], 'keep')
        self.assertNotIn('hide', [item['id'] for item in result])


if __name__ == '__main__':
    unittest.main()
