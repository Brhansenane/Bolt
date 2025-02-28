import { motion } from 'framer-motion';
import { GithubConnection } from './GithubConnection';
import { NetlifyConnection } from './NetlifyConnection';
import '~/styles/components/connections.scss';

export default function ConnectionsTab() {
  return (
    <div className="connections-container">
      {/* Header */}
      <motion.div
        className="connections-header"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="i-ph:plugs-connected header-icon" />
        <h2 className="header-title">Connection Settings</h2>
      </motion.div>
      <p className="header-description">Manage your external service connections and integrations</p>

      {/* GitHub Connection Section */}
      <div className="section-header">
        <h3 className="section-title">GitHub Integration</h3>
        <p className="section-description">
          Connect your GitHub account to enable repository cloning and other GitHub features. This connection is
          required for the "Clone a Git Repo" functionality.
        </p>
      </div>
      <GithubConnection />

      {/* Other Connections Section */}
      <div className="section-header mt-8">
        <h3 className="section-title">Other Integrations</h3>
        <p className="section-description">Additional service connections for deployment and other features.</p>
      </div>
      <div className="connections-grid">
        <NetlifyConnection />
      </div>
    </div>
  );
}
