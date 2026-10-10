/**
 * Dependency injection container for client
 *
 * Wires up all adapters. Lazy initialization -- dependencies are created
 * only when first accessed. Swap any implementation by changing one line here;
 * business logic stays completely unchanged.
 */

import {
    type ConfigProvider,
    ConsoleLogger,
    type DateProvider,
    FetchHttpClient,
    type I18nAdapter,
    JsonI18nAdapter,
    type Logger,
    LogLevel,
    NativeDateProvider,
} from '@erledigen/shared';
import { ViteConfigProvider } from './adapters/config/ViteConfigProvider';
import { resolveApiBaseUrl } from './apiBaseUrl';
import { DEFAULT_LOCALE, LOCALE_FILES } from './i18n/locales';

export class Container {
    private _config: ConfigProvider | null = null;
    // The client container wires FetchHttpClient concretely (that is its
    // job); consumers see the HttpClient port through the getter's return
    // type, so setClientId needs no downcast.
    private _httpClient: FetchHttpClient | null = null;
    private _logger: Logger | null = null;
    private _dateProvider: DateProvider | null = null;
    private _i18n: I18nAdapter | null = null;

    get config(): ConfigProvider {
        if (!this._config) {
            this._config = new ViteConfigProvider();
        }
        return this._config;
    }

    get httpClient(): FetchHttpClient {
        if (!this._httpClient) {
            const configured = this.config.get('VITE_API_URL', 'http://localhost:4000');
            // Empty string = same-origin deployment (reverse-proxied prod
            // stack); see lib/apiBaseUrl.ts.
            this._httpClient = new FetchHttpClient(resolveApiBaseUrl(configured));
        }
        return this._httpClient;
    }

    get logger(): Logger {
        if (!this._logger) {
            // VITE_LOG_LEVEL (debug|info|warn|error) wins when set; otherwise
            // debug in development, info in production builds.
            const configured = this.config.get('VITE_LOG_LEVEL', '');
            const parsed = (['debug', 'info', 'warn', 'error'] as const).find(
                level => level === configured,
            );
            const logLevel =
                parsed !== undefined
                    ? LogLevel[parsed.toUpperCase() as keyof typeof LogLevel]
                    : this.config.getBoolean('DEV', false)
                      ? LogLevel.DEBUG
                      : LogLevel.INFO;
            this._logger = new ConsoleLogger(logLevel);
        }
        return this._logger;
    }

    get dateProvider(): DateProvider {
        if (!this._dateProvider) {
            this._dateProvider = new NativeDateProvider();
        }
        return this._dateProvider;
    }

    /** The message adapter over the shipped locale files (v0.13.0).
     *  Locale switching goes through the i18n store's apply(); the
     *  adapter itself is a lazy singleton like every other port. */
    get i18n(): I18nAdapter {
        if (!this._i18n) {
            this._i18n = new JsonI18nAdapter(LOCALE_FILES, { defaultLocale: DEFAULT_LOCALE });
        }
        return this._i18n;
    }

    /**
     * Set the date provider's timezone (IANA zone, or null for device local).
     * Called once user preferences load / when the user changes their zone.
     */
    setDateProviderTimeZone(timeZone: string | null): void {
        this.dateProvider.setTimeZone(timeZone);
    }

    /**
     * Set the date provider's DISPLAY locale (USE-15): date/time labels
     * localize; storage formats stay fixed. Called on the same path as
     * the i18n store's apply (preferences load / language change).
     */
    setDateProviderLocale(locale: string): void {
        this.dateProvider.setLocale(locale);
    }

    setClientId(clientId: string | null): void {
        const http = this.httpClient;
        if (clientId) {
            http.setDefaultHeaders({ 'X-Client-ID': clientId });
        } else {
            http.removeDefaultHeader('X-Client-ID');
        }
    }
}

export const container = new Container();
