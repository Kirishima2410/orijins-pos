import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authAPI } from '../utils/api';
import { AuthUser, LoginForm } from '../types';
import toast from 'react-hot-toast';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (credentials: LoginForm) => Promise<boolean>;
  logout: () => void;
  updateUser: (user: AuthUser) => void;
  isAuthenticated: boolean;
  hasRole: (roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Check if user is authenticated
  const isAuthenticated = !!user;

  // Check if user has required role
  const hasRole = (roles: string[]): boolean => {
    return user ? roles.includes(user.role) : false;
  };

  // Update user data
  const updateUser = (newUser: AuthUser) => {
    setUser(newUser);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  // Login function
  const login = async (credentials: LoginForm): Promise<boolean> => {
    try {
      setLoading(true);
      const response = await authAPI.login(credentials);
      
      if (response.data.token && response.data.user) {
        const { token, user: userData } = response.data;
        
        // Store token and user data
        localStorage.setItem('authToken', token);
        localStorage.setItem('user', JSON.stringify(userData));
        
        // Update state
        setUser(userData);
        
        toast.success(`Welcome back, ${userData.username}!`);
        return true;
      }
      
      return false;
    } catch (error: any) {
      console.error('Login error:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    try {
      // Call logout API if user is authenticated
      if (user) {
        await authAPI.logout();
      }
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      // Clear local storage and state regardless of API call success
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      setUser(null);
      toast.success('Logged out successfully');
    }
  };

  // Verify token on app load
  useEffect(() => {
    const verifyToken = async () => {
      const token = localStorage.getItem('authToken');
      const storedUser = localStorage.getItem('user');

      if (token && storedUser) {
        try {
          const response = await authAPI.verify();
          
          if (response.data.valid && response.data.user) {
            setUser(response.data.user);
            // Update stored user data in case it changed
            localStorage.setItem('user', JSON.stringify(response.data.user));
          } else {
            // Invalid token, clear storage
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
          }
        } catch (error) {
          console.error('Token verification error:', error);
          // Token is invalid or expired, clear storage
          localStorage.removeItem('authToken');
          localStorage.removeItem('user');
        }
      }
      
      setLoading(false);
    };

    verifyToken();
  }, []);

  // Auto-logout on token expiry
  useEffect(() => {
    if (!user) return;

    const checkTokenExpiry = () => {
      const token = localStorage.getItem('authToken');
      if (!token) {
        logout();
        return;
      }

      try {
        // Decode JWT token to check expiry
        const payload = JSON.parse(atob(token.split('.')[1]));
        const currentTime = Date.now() / 1000;
        
        if (payload.exp < currentTime) {
          logout();
        }
      } catch (error) {
        console.error('Token decode error:', error);
        logout();
      }
    };

    // Check token expiry every 5 minutes
    const interval = setInterval(checkTokenExpiry, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [user]);

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    updateUser,
    isAuthenticated,
    hasRole,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
