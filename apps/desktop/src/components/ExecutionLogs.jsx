// components/ExecutionLogs.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  FaFilter,
  FaTwitter,
  FaExclamationTriangle,
  FaInfoCircle,
  FaCheckCircle,
  FaSearch,
  FaList,
} from 'react-icons/fa';
import './ExecutionLogs.css';

const LOGS_PER_PAGE = 50;
const LOG_REFRESH_INTERVAL_MS = 30000;
const LOG_TYPE_LABELS = {
  tweet: 'ツイート',
  error: 'エラー',
  info: '情報',
  warning: '警告',
};

function ExecutionLogs() {
  const [logs, setLogs] = useState([]);
  const [botAccounts, setBotAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [selectedLogLevel, setSelectedLogLevel] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const logData = await invoke('get_execution_logs', {
        accountId: null,
        limit: 500,
      });
      setLogs(Array.isArray(logData) ? logData : []);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchBotAccounts = useCallback(async () => {
    try {
      const accounts = await invoke('get_bot_accounts');
      setBotAccounts(Array.isArray(accounts) ? accounts : []);
    } catch (error) {
      console.error('Failed to fetch bot accounts:', error);
      setBotAccounts([]);
    }
  }, []);

  useEffect(() => {
    fetchBotAccounts();
    fetchLogs();

    const intervalId = setInterval(fetchLogs, LOG_REFRESH_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [fetchBotAccounts, fetchLogs]);

  const accountMap = useMemo(() => {
    const map = new Map();
    botAccounts.forEach((account) => {
      if (account && account.id !== undefined && account.id !== null) {
        map.set(account.id, account);
      }
    });
    return map;
  }, [botAccounts]);

  const filteredLogs = useMemo(() => {
    const accountFilter = selectedAccount ? Number.parseInt(selectedAccount, 10) : null;
    const normalizedTerm = searchTerm.trim().toLowerCase();

    return logs.filter((log) => {
      if (!log) {
        return false;
      }

      if (accountFilter !== null && log.account_id !== accountFilter) {
        return false;
      }

      if (selectedLogLevel && log.status !== selectedLogLevel) {
        return false;
      }

      if (!normalizedTerm) {
        return true;
      }

      const message = (log.message || '').toLowerCase();
      const tweetContent = (log.tweet_content || '').toLowerCase();

      return message.includes(normalizedTerm) || tweetContent.includes(normalizedTerm);
    });
  }, [logs, selectedAccount, selectedLogLevel, searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedAccount, selectedLogLevel, searchTerm]);

  useEffect(() => {
    const maxPage = Math.max(Math.ceil(filteredLogs.length / LOGS_PER_PAGE), 1);
    setCurrentPage((prev) => Math.min(prev, maxPage));
  }, [filteredLogs.length]);

  const totalPages = Math.ceil(filteredLogs.length / LOGS_PER_PAGE);
  const indexOfFirstLog = (currentPage - 1) * LOGS_PER_PAGE;
  const indexOfLastLog = indexOfFirstLog + LOGS_PER_PAGE;
  const currentLogs = filteredLogs.slice(indexOfFirstLog, indexOfLastLog);
  const displayStart = filteredLogs.length === 0 ? 0 : indexOfFirstLog + 1;
  const displayEnd = Math.min(indexOfLastLog, filteredLogs.length);
  const shouldShowPagination = totalPages > 1;

  const paginate = useCallback(
    (pageNumber) => {
      if (!Number.isFinite(pageNumber)) {
        return;
      }

      setCurrentPage((prev) => {
        const maxPage = Math.max(totalPages, 1);
        const next = Math.min(Math.max(pageNumber, 1), maxPage);
        return next === prev ? prev : next;
      });
    },
    [totalPages],
  );

  const getAccountName = (accountId) => {
    const account = accountMap.get(accountId);
    return account?.api_name || `Account ${accountId}`;
  };

  const getAccountTwitterId = (accountId) => {
    const account = accountMap.get(accountId);
    return account?.twitter_username || '';
  };

  const formatDateTime = (dateString) => {
    if (!dateString) {
      return '-';
    }

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
      return dateString;
    }

    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getLogIcon = (logType, status) => {
    if (status === 'error') {
      return <FaExclamationTriangle className="log-icon error" />;
    }
    if (status === 'success') {
      return <FaCheckCircle className="log-icon success" />;
    }
    if (logType === 'tweet') {
      return <FaTwitter className="log-icon tweet" />;
    }
    return <FaInfoCircle className="log-icon info" />;
  };

  const getLogTypeText = (logType) => LOG_TYPE_LABELS[logType] || logType;

  const openTweet = (tweetId, twitterUsername) => {
    if (tweetId && twitterUsername) {
      const url = `https://twitter.com/${twitterUsername}/status/${tweetId}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Bot実行ログ</h1>
        <p className="page-subtitle">各Botの実行状況とエラー詳細を確認できます。</p>
      </div>

      <div className="card">
        <div className="filter-controls">
          <div className="filter-group">
            <label className="filter-label">
              <FaFilter className="filter-icon" /> 対象アカウント
            </label>
            <select
              className="form-select"
              value={selectedAccount}
              onChange={(event) => setSelectedAccount(event.target.value)}
            >
              <option value="">全て</option>
              {botAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.api_name} (@{account.twitter_username})
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">ログレベル</label>
            <select
              className="form-select"
              value={selectedLogLevel}
              onChange={(event) => setSelectedLogLevel(event.target.value)}
            >
              <option value="">全て</option>
              <option value="success">成功</option>
              <option value="error">エラー</option>
              <option value="warning">警告</option>
            </select>
          </div>

          <div className="filter-group search-group">
            <label className="filter-label">
              <FaSearch className="filter-icon" /> 検索
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="メッセージまたは投稿内容で検索..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>

          <button
            className="btn btn-primary"
            onClick={fetchLogs}
            disabled={isLoading}
          >
            {isLoading ? '更新中...' : '更新'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            検索結果（{displayStart} ～ {displayEnd} / {filteredLogs.length}件）
            <span className="card-hint">最新500件のログを表示中</span>
          </h2>
        </div>

        {isLoading ? (
          <div className="loading">
            <div className="spinner" />
            読み込み中...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <FaList />
            </div>
            <h3 className="empty-state-title">ログが見つかりません</h3>
            <p className="empty-state-description">
              {logs.length === 0
                ? 'まだ実行ログがありません。Botを追加して実行してください。'
                : '条件に一致するログがありません。フィルターを調整してください。'}
            </p>
          </div>
        ) : (
          <>
            {shouldShowPagination && (
              <div className="pagination-container">
                <div className="pagination">
                  <button
                    className="pagination-btn"
                    onClick={() => paginate(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    前へ
                  </button>

                  {Array.from({ length: Math.min(5, totalPages) }, (_, index) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = index + 1;
                    } else if (currentPage <= 3) {
                      pageNum = index + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + index;
                    } else {
                      pageNum = currentPage - 2 + index;
                    }

                    return (
                      <button
                        key={pageNum}
                        className={`pagination-btn ${currentPage === pageNum ? 'active' : ''}`}
                        onClick={() => paginate(pageNum)}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    className="pagination-btn"
                    onClick={() => paginate(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    次へ
                  </button>
                </div>
              </div>
            )}

            <div className="logs-list">
              {currentLogs.map((log) => (
                <div key={log.id} className={`log-item ${log.status}`}>
                  <div className="log-header">
                    <div className="log-meta">
                      <span className="log-time">{formatDateTime(log.created_at)}</span>
                      <span className="log-account">[{getAccountName(log.account_id)}]</span>
                      <span className={`log-type ${log.log_type}`}>
                        {getLogTypeText(log.log_type)}
                      </span>
                    </div>
                    <div className="log-status">{getLogIcon(log.log_type, log.status)}</div>
                  </div>

                  <div className="log-content">
                    <div className="log-message">{log.message}</div>

                    {log.tweet_content && (
                      <div className="tweet-content">
                        <strong>投稿内容:</strong> {log.tweet_content}
                      </div>
                    )}

                    {log.tweet_id && (
                      <div className="log-actions">
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => openTweet(log.tweet_id, getAccountTwitterId(log.account_id))}
                        >
                          <FaTwitter /> ツイートを表示
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {shouldShowPagination && (
              <div className="pagination-container">
                <div className="pagination">
                  <button
                    className="pagination-btn"
                    onClick={() => paginate(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    前へ
                  </button>

                  {Array.from({ length: Math.min(5, totalPages) }, (_, index) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = index + 1;
                    } else if (currentPage <= 3) {
                      pageNum = index + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + index;
                    } else {
                      pageNum = currentPage - 2 + index;
                    }

                    return (
                      <button
                        key={pageNum}
                        className={`pagination-btn ${currentPage === pageNum ? 'active' : ''}`}
                        onClick={() => paginate(pageNum)}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    className="pagination-btn"
                    onClick={() => paginate(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    次へ
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default ExecutionLogs;
