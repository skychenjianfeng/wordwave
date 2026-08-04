import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;

import 'models.dart';

class ApiException implements Exception {
  final String message;
  ApiException(this.message);
  @override
  String toString() => message;
}

class ApiClient {
  String baseUrl;
  String? token;

  ApiClient({required this.baseUrl, this.token});

  Uri _u(String path, [Map<String, String>? q]) {
    final base = baseUrl.endsWith('/') ? baseUrl.substring(0, baseUrl.length - 1) : baseUrl;
    final uri = Uri.parse('$base$path');
    if (q == null || q.isEmpty) return uri;
    return uri.replace(queryParameters: q);
  }

  Map<String, String> _headers({bool json = true}) => {
        if (json) 'Content-Type': 'application/json',
        if (token != null && token!.isNotEmpty) 'Authorization': 'Bearer $token',
      };

  Future<Map<String, dynamic>> _json(String method, String path,
      {Object? body, Map<String, String>? query}) async {
    final http.Response res;
    try {
      switch (method) {
        case 'GET':
          res = await http.get(_u(path, query), headers: _headers()).timeout(const Duration(seconds: 30));
          break;
        case 'POST':
          res = await http
              .post(_u(path, query), headers: _headers(), body: body == null ? null : jsonEncode(body))
              .timeout(const Duration(seconds: 30));
          break;
        case 'PUT':
          res = await http
              .put(_u(path, query), headers: _headers(), body: body == null ? null : jsonEncode(body))
              .timeout(const Duration(seconds: 30));
          break;
        case 'PATCH':
          res = await http
              .patch(_u(path, query), headers: _headers(), body: body == null ? null : jsonEncode(body))
              .timeout(const Duration(seconds: 30));
          break;
        case 'DELETE':
          res = await http.delete(_u(path, query), headers: _headers()).timeout(const Duration(seconds: 30));
          break;
        default:
          throw ApiException('unsupported method');
      }
    } catch (e) {
      throw ApiException('网络请求失败: $e');
    }
    final decoded = jsonDecode(utf8.decode(res.bodyBytes));
    if (decoded is! Map<String, dynamic>) throw ApiException('响应格式错误');
    if (res.statusCode < 200 || res.statusCode >= 300 || decoded['ok'] != true) {
      throw ApiException((decoded['error'] as String?) ?? '请求失败（HTTP ${res.statusCode}）');
    }
    return decoded;
  }

  Future<Map<String, dynamic>> get(String path, {Map<String, String>? query}) =>
      _json('GET', path, query: query);
  Future<Map<String, dynamic>> post(String path, [Object? body]) => _json('POST', path, body: body);
  Future<Map<String, dynamic>> put(String path, Object? body) => _json('PUT', path, body: body);
  Future<Map<String, dynamic>> patch(String path, Object? body) => _json('PATCH', path, body: body);
  Future<Map<String, dynamic>> delete(String path) => _json('DELETE', path);

  Future<({AuthUser user, String token})> register(String username, String password) async {
    final r = await post('/api/auth/register', {'username': username, 'password': password});
    return (
      user: AuthUser.fromJson(r['user'] as Map<String, dynamic>),
      token: (r['token'] as String?) ?? '',
    );
  }

  Future<({AuthUser user, String token})> login(String username, String password) async {
    final r = await post('/api/auth/login', {'username': username, 'password': password});
    return (
      user: AuthUser.fromJson(r['user'] as Map<String, dynamic>),
      token: (r['token'] as String?) ?? '',
    );
  }

  Future<AuthUser> me() async {
    final r = await get('/api/auth/me');
    return AuthUser.fromJson(r['user'] as Map<String, dynamic>);
  }

  Future<void> logout() async {
    try {
      await post('/api/auth/logout');
    } catch (_) {}
  }

  Future<Map<String, dynamic>> getProgress() async {
    final r = await get('/api/user/progress');
    return (r['data'] as Map<String, dynamic>?) ?? {};
  }

  Future<void> putProgress(Map<String, dynamic> records, Map<String, List<String>> dailyWords) async {
    await put('/api/user/progress', {'records': records, 'dailyWords': dailyWords});
  }

  Future<UserProfile> getProfile() async {
    final r = await get('/api/user/profile');
    return UserProfile.fromJson(r['profile'] as Map<String, dynamic>);
  }

  Future<void> patchProfile(Map<String, dynamic> data) async {
    await patch('/api/user/profile', data);
  }

  Future<void> changePassword(String oldPwd, String newPwd) async {
    await post('/api/user/change-password', {'oldPassword': oldPwd, 'newPassword': newPwd});
  }

  Future<UserStats> getStats() async {
    final r = await get('/api/user/stats');
    return UserStats.fromJson(r['stats'] as Map<String, dynamic>);
  }

  Future<ExampleData> example(
      String word, String meaning, bool withTranslation, ExampleStyle style) async {
    final r = await post('/api/example', {
      'word': word,
      'meaning': meaning,
      'withTranslation': withTranslation,
      'style': style.name,
    });
    return ExampleData.fromJson(r['data'] as Map<String, dynamic>);
  }

  Future<int> clearExampleCache() async {
    final r = await delete('/api/example/cache');
    return (r['deleted'] as num?)?.toInt() ?? 0;
  }

  Future<List<DictMeta>> dicts() async {
    final r = await get('/api/dicts');
    return ((r['data'] as List?) ?? [])
        .map((e) => DictMeta.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<Uint8List> speech(String text, String lang, String accent) async {
    final res = await http
        .get(_u('/api/speech', {'text': text, 'lang': lang, 'accent': accent}), headers: _headers(json: false))
        .timeout(const Duration(seconds: 30));
    if (res.statusCode != 200) throw ApiException('本地语音合成失败（HTTP ${res.statusCode}）');
    return res.bodyBytes;
  }

  Future<Uint8List> audio(String path) async {
    final res = await http.get(_u(path), headers: _headers(json: false)).timeout(const Duration(seconds: 30));
    if (res.statusCode != 200) throw ApiException('音频获取失败（HTTP ${res.statusCode}）');
    return res.bodyBytes;
  }
}
