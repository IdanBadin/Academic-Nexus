import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/hooks/useAuth'
import { LoadingBlock } from '@/components/ui/States'
import { ToastProvider } from '@/components/ui/Toast'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { AiAssistantProvider } from '@/components/ai/AiAssistantContext'
import { AiChatWidget } from '@/components/ai/AiChatWidget'

import Landing from '@/pages/Landing'
import Login from '@/pages/auth/Login'
import Signup from '@/pages/auth/Signup'
import Suspended from '@/pages/Suspended'
import NotFound from '@/pages/NotFound'
import OAuthCallback from '@/pages/OAuthCallback'

import StudentLayout from '@/pages/student/StudentLayout'
import StudentSearch from '@/pages/student/Search'
import StudentExpertProfile from '@/pages/student/ExpertProfile'
import StudentBook from '@/pages/student/Book'
import StudentBookings from '@/pages/student/Bookings'
import StudentBookingDetail from '@/pages/student/BookingDetail'

import ExpertLayout from '@/pages/expert/ExpertLayout'
import ExpertProfileEditor from '@/pages/expert/ProfileEditor'
import ExpertListings from '@/pages/expert/Listings'
import ExpertAvailability from '@/pages/expert/AvailabilityManager'
import ExpertRequests from '@/pages/expert/Requests'
import ExpertReviews from '@/pages/expert/Reviews'
import ExpertBookingDetail from '@/pages/expert/BookingDetail'

// The admin area pulls in Recharts, which is large and only three people will
// ever load it. Split it out so nobody else pays for it.
const AdminLayout = lazy(() => import('@/pages/admin/AdminLayout'))
const AdminDashboard = lazy(() => import('@/pages/admin/Dashboard'))
const AdminUsers = lazy(() => import('@/pages/admin/Users'))
const AdminDisputes = lazy(() => import('@/pages/admin/Disputes'))
const AdminLogs = lazy(() => import('@/pages/admin/Logs'))
const ExpertEarningsLazy = lazy(() => import('@/pages/expert/Earnings'))

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AiAssistantProvider>
          <Suspense fallback={<LoadingBlock label="Loading" />}>
          <Routes>
            {/* Public */}
            <Route path="/" element={<Landing />} />
            <Route path="/auth/login" element={<Login />} />
            <Route path="/auth/signup" element={<Signup />} />
            <Route path="/oauth/google" element={<OAuthCallback />} />
            <Route path="/suspended" element={<Suspended />} />

            {/* Student */}
            <Route
              path="/student"
              element={
                <ProtectedRoute role="student">
                  <StudentLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/student/search" replace />} />
              <Route path="search" element={<StudentSearch />} />
              <Route path="experts/:id" element={<StudentExpertProfile />} />
              <Route path="book/:listingId" element={<StudentBook />} />
              <Route path="bookings" element={<StudentBookings />} />
              <Route path="bookings/:id" element={<StudentBookingDetail />} />
            </Route>

            {/* Expert */}
            <Route
              path="/expert"
              element={
                <ProtectedRoute role="expert">
                  <ExpertLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/expert/requests" replace />} />
              <Route path="requests" element={<ExpertRequests />} />
              <Route path="listings" element={<ExpertListings />} />
              <Route path="availability" element={<ExpertAvailability />} />
              <Route path="earnings" element={<ExpertEarningsLazy />} />
              <Route path="reviews" element={<ExpertReviews />} />
              <Route path="profile" element={<ExpertProfileEditor />} />
              <Route path="bookings/:id" element={<ExpertBookingDetail />} />
            </Route>

            {/* Admin */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute role="admin">
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="disputes" element={<AdminDisputes />} />
              <Route path="logs" element={<AdminLogs />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>

          {/* Floating assistant. Renders nothing when there is no session. */}
          <AiChatWidget />
        </AiAssistantProvider>
      </ToastProvider>
    </AuthProvider>
  )
}
